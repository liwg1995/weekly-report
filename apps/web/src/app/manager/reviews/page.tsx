"use client";

import { useEffect, useState } from "react";
import { ApiClientError, apiGet, apiPatch, apiPost } from "../../../lib/api-client";
import { getSessionUser, logoutWithConfirm, requireRole } from "../../../lib/auth-session";
import SessionExpiryNotice from "../../../components/session-expiry-notice";
import "./reviews.css";

type ReviewItem = {
  id: number;
  thisWeekText: string;
  status: string;
};

type AuditItem = {
  id: number;
  action: string;
  targetId: string;
  createdAt: string;
  actor: { id: number; username: string; realName: string } | null;
};

type ExportColumn = "time" | "actor" | "action" | "targetId";

const EXPORT_PREFERENCES_KEY = "manager_reviews_export_preferences";
const EXPORT_HISTORY_KEY = "manager_reviews_export_history";
const EXPORT_HISTORY_PAGE_SIZE = 5;
const DEFAULT_EXPORT_COLUMNS: Record<ExportColumn, boolean> = {
  time: true,
  actor: true,
  action: true,
  targetId: true
};

type ExportHistoryItem = {
  id: string;
  fileName: string;
  createdAt: string;
  content: string;
  mimeType: string;
  filters?: {
    decision?: "all" | "APPROVED" | "REJECTED";
    actorKeyword?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  columns?: Record<ExportColumn, boolean>;
  encoding?: "utf-8" | "gbk";
};

type ExportTemplate = {
  id: string;
  name: string;
  createdAt: string;
  pinned: boolean;
  diffExportMaskSensitive?: boolean;
  filters: {
    decision?: "all" | "APPROVED" | "REJECTED";
    actorKeyword?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  columns: Record<ExportColumn, boolean>;
  encoding: "utf-8" | "gbk";
};

type TemplateVersion = {
  id: number;
  templateId: string;
  createdAt: string;
  name: string;
  pinned: boolean;
  filters: ExportTemplate["filters"];
  columns: ExportTemplate["columns"];
  encoding: "utf-8" | "gbk";
};

const formatDecisionLabel = (decision?: "all" | "APPROVED" | "REJECTED") => {
  if (decision === "APPROVED") {
    return "仅通过";
  }
  if (decision === "REJECTED") {
    return "仅驳回";
  }
  return "全部";
};

const formatTemplateFilters = (filters: ExportTemplate["filters"]) => {
  return [
    `结果：${formatDecisionLabel(filters.decision)}`,
    `审批人关键词：${filters.actorKeyword?.trim() ? filters.actorKeyword.trim() : "无"}`,
    `开始日期：${filters.dateFrom?.trim() ? filters.dateFrom.trim() : "未设置"}`,
    `结束日期：${filters.dateTo?.trim() ? filters.dateTo.trim() : "未设置"}`
  ].join("，");
};

const formatTemplateColumns = (columns: ExportTemplate["columns"]) => {
  return [
    `时间：${columns.time ? "是" : "否"}`,
    `审批人：${columns.actor ? "是" : "否"}`,
    `动作：${columns.action ? "是" : "否"}`,
    `周报ID：${columns.targetId ? "是" : "否"}`
  ].join("，");
};

const DIFF_VALUE_PREVIEW_MAX = 48;

const readExportColumns = (): Record<ExportColumn, boolean> => {
  if (typeof window === "undefined") {
    return DEFAULT_EXPORT_COLUMNS;
  }
  try {
    const raw = window.localStorage.getItem(EXPORT_PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_EXPORT_COLUMNS;
    }
    const parsed = JSON.parse(raw) as {
      columns?: Partial<Record<ExportColumn, boolean>>;
    };
    return {
      time: parsed.columns?.time ?? DEFAULT_EXPORT_COLUMNS.time,
      actor: parsed.columns?.actor ?? DEFAULT_EXPORT_COLUMNS.actor,
      action: parsed.columns?.action ?? DEFAULT_EXPORT_COLUMNS.action,
      targetId: parsed.columns?.targetId ?? DEFAULT_EXPORT_COLUMNS.targetId
    };
  } catch {
    return DEFAULT_EXPORT_COLUMNS;
  }
};

const readExportEncoding = (): "utf-8" | "gbk" => {
  if (typeof window === "undefined") {
    return "utf-8";
  }
  try {
    const raw = window.localStorage.getItem(EXPORT_PREFERENCES_KEY);
    if (!raw) {
      return "utf-8";
    }
    const parsed = JSON.parse(raw) as {
      encoding?: string;
    };
    return parsed.encoding === "gbk" ? "gbk" : "utf-8";
  } catch {
    return "utf-8";
  }
};

const readDiffExportMaskSensitive = (): boolean => {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(EXPORT_PREFERENCES_KEY);
    if (!raw) {
      return true;
    }
    const parsed = JSON.parse(raw) as {
      diffExportMaskSensitive?: boolean;
    };
    return parsed.diffExportMaskSensitive !== false;
  } catch {
    return true;
  }
};

const readExportHistory = (): ExportHistoryItem[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(EXPORT_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ExportHistoryItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => Boolean(item?.id && item?.fileName && item?.content))
      .slice(0, 10);
  } catch {
    return [];
  }
};

export default function ManagerReviewsPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [rejectTargetIds, setRejectTargetIds] = useState<number[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [logDecision, setLogDecision] = useState<"all" | "APPROVED" | "REJECTED">("all");
  const [logActorKeyword, setLogActorKeyword] = useState("");
  const [logDateFrom, setLogDateFrom] = useState("");
  const [logDateTo, setLogDateTo] = useState("");
  const [statsRange, setStatsRange] = useState<"today" | "7d" | "month">("today");
  const [exportColumns, setExportColumns] = useState<Record<ExportColumn, boolean>>(
    () => readExportColumns()
  );
  const [exportEncoding, setExportEncoding] = useState<"utf-8" | "gbk">(
    () => readExportEncoding()
  );
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>(() =>
    readExportHistory()
  );
  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateJsonText, setTemplateJsonText] = useState("");
  const [pendingImportTemplates, setPendingImportTemplates] = useState<ExportTemplate[] | null>(
    null
  );
  const [pendingDuplicateCount, setPendingDuplicateCount] = useState(0);
  const [templateRenameMap, setTemplateRenameMap] = useState<Record<string, string>>({});
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historySortBy, setHistorySortBy] = useState<"createdAt" | "fileName">("createdAt");
  const [historySortDir, setHistorySortDir] = useState<"asc" | "desc">("desc");
  const [templateOwnerUserId, setTemplateOwnerUserId] = useState("");
  const [templateVersions, setTemplateVersions] = useState<Record<string, TemplateVersion[]>>({});
  const [templateVersionLoadingId, setTemplateVersionLoadingId] = useState("");
  const [templateVersionDiffOpenMap, setTemplateVersionDiffOpenMap] = useState<
    Record<string, boolean>
  >({});
  const [templateDiffValueExpandMap, setTemplateDiffValueExpandMap] = useState<
    Record<string, boolean>
  >({});
  const [maskSensitiveInDiffExport, setMaskSensitiveInDiffExport] = useState(
    () => readDiffExportMaskSensitive()
  );
  const [templateSwitching, setTemplateSwitching] = useState(false);
  const [templateSwitchedOwner, setTemplateSwitchedOwner] = useState("");
  const sessionUser = getSessionUser();
  const isSuperAdmin = Boolean(sessionUser?.roles.includes("SUPER_ADMIN"));

  const buildAuditLogsQuery = (
    limit: number,
    filters?: {
      decision?: "all" | "APPROVED" | "REJECTED";
      actorKeyword?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    const decision = filters?.decision ?? logDecision;
    const actorKeyword = (filters?.actorKeyword ?? logActorKeyword).trim();
    const dateFrom = filters?.dateFrom ?? logDateFrom;
    const dateTo = filters?.dateTo ?? logDateTo;

    if (decision !== "all") {
      params.set("decision", decision);
    }
    if (actorKeyword) {
      params.set("actorKeyword", actorKeyword);
    }
    if (dateFrom) {
      params.set("dateFrom", dateFrom);
    }
    if (dateTo) {
      params.set("dateTo", dateTo);
    }

    return params.toString();
  };

  const loadAuditLogs = async (filters?: {
    decision?: "all" | "APPROVED" | "REJECTED";
    actorKeyword?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    try {
      const query = buildAuditLogsQuery(10, filters);
      const data = await apiGet<{ items: AuditItem[] }>(
        `/api/audit-logs/reviews?${query}`
      );
      setLogs(data.items);
    } catch {
      // Ignore audit log load failures to avoid blocking review flow.
    }
  };

  const buildTemplateOwnerQuery = (ownerUserId?: string) => {
    const owner = (ownerUserId ?? templateOwnerUserId).trim();
    if (!isSuperAdmin || !owner) {
      return "";
    }
    return `?ownerUserId=${encodeURIComponent(owner)}`;
  };

  const loadTemplatesFromServer = async (
    ownerUserId?: string,
    options?: { switching?: boolean }
  ) => {
    if (options?.switching) {
      setTemplateSwitching(true);
      setTemplateSwitchedOwner((ownerUserId ?? templateOwnerUserId).trim());
    }
    try {
      const templates = await apiGet<{ items: ExportTemplate[] }>(
        `/api/audit-logs/review-templates${buildTemplateOwnerQuery(ownerUserId)}`
      );
      setExportTemplates(
        templates.items
          .filter((item) => Boolean(item?.id && item?.name))
          .slice(0, 20)
      );
    } catch {
      // Ignore template load failures and keep empty state.
    } finally {
      if (options?.switching) {
        setTemplateSwitching(false);
      }
    }
  };

  const ownerUserIdAsNumber = () => {
    if (!isSuperAdmin) {
      return undefined;
    }
    const owner = templateOwnerUserId.trim();
    if (!owner) {
      return undefined;
    }
    const parsed = Number(owner);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  useEffect(() => {
    const load = async () => {
      const allowed = requireRole(
        ["SUPER_ADMIN", "DEPT_ADMIN", "MANAGER", "LEADER"],
        "/employee/feedback"
      );
      if (!allowed) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiGet<{ items: ReviewItem[] }>(
          "/api/weekly-reports?status=PENDING_APPROVAL"
        );
        setItems(data.items);
        await loadAuditLogs();
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 403) {
          setError("你当前没有审批权限，请联系管理员分配角色。");
          return;
        }
        if (err instanceof ApiClientError && err.status === 401) {
          setError("登录已过期，请重新登录。");
          return;
        }
        if (err instanceof ApiClientError) {
          setError("加载审批列表失败，请稍后重试。");
          return;
        }
        setError("网络异常，请检查连接后重试。");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const timer = window.setTimeout(() => {
      void loadTemplatesFromServer();
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      EXPORT_PREFERENCES_KEY,
      JSON.stringify({
        columns: exportColumns,
        encoding: exportEncoding,
        diffExportMaskSensitive: maskSensitiveInDiffExport
      })
    );
  }, [exportColumns, exportEncoding, maskSensitiveInDiffExport]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(EXPORT_HISTORY_KEY, JSON.stringify(exportHistory));
  }, [exportHistory]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyQuery]);

  const updateExportTemplates = (
    updater: ExportTemplate[] | ((prev: ExportTemplate[]) => ExportTemplate[])
  ) => {
    setExportTemplates((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const uniqueByName = new Map<string, ExportTemplate>();
      next.forEach((item) => {
        if (!uniqueByName.has(item.name)) {
          uniqueByName.set(item.name, item);
        }
      });
      return [...uniqueByName.values()].slice(0, 20);
    });
  };

  const reviewMany = async (
    reportIds: number[],
    decision: "APPROVED" | "REJECTED",
    comment?: string
  ) => {
    if (reportIds.length === 0) {
      setError("请至少选择一条周报");
      return;
    }

    setNotice("");
    try {
      await Promise.all(
        reportIds.map((reportId) =>
          apiPost(`/api/weekly-reports/${reportId}/review`, {
            decision,
            comment:
              comment ??
              (decision === "APPROVED" ? "审批通过" : "请补充后重提")
          })
        )
      );
      setItems((prev) => prev.filter((item) => !reportIds.includes(item.id)));
      setSelectedIds((prev) => prev.filter((id) => !reportIds.includes(id)));
      setNotice(
        decision === "APPROVED"
          ? `已通过 ${reportIds.length} 条周报`
          : `已驳回 ${reportIds.length} 条周报`
      );
      await loadAuditLogs();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        setError("你当前没有审批权限，请联系管理员分配角色。");
        return;
      }
      if (err instanceof ApiClientError && err.status === 401) {
        setError("登录已过期，请重新登录。");
        return;
      }
      setError("审批操作失败，请稍后重试。");
    }
  };

  const confirmReject = async () => {
    if (rejectTargetIds.length === 0) {
      return;
    }
    const reason = rejectReason.trim();
    if (!reason) {
      setError("请填写驳回原因");
      return;
    }
    await reviewMany(rejectTargetIds, "REJECTED", reason);
    setRejectTargetIds([]);
    setRejectReason("");
  };

  const toggleSelected = (id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const toCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const applyExportPreset = (preset: "retro" | "audit") => {
    if (preset === "retro") {
      setExportColumns({
        time: true,
        actor: false,
        action: true,
        targetId: true
      });
      setExportEncoding("utf-8");
      return;
    }
    setExportColumns({
      time: true,
      actor: true,
      action: true,
      targetId: true
    });
    setExportEncoding("gbk");
  };

  const exportLogsCsv = (options?: {
    filters?: {
      decision?: "all" | "APPROVED" | "REJECTED";
      actorKeyword?: string;
      dateFrom?: string;
      dateTo?: string;
    };
    columns?: Record<ExportColumn, boolean>;
    encoding?: "utf-8" | "gbk";
  }) => {
    const doExport = async () => {
      try {
        const appliedFilters = options?.filters ?? {
          decision: logDecision,
          actorKeyword: logActorKeyword,
          dateFrom: logDateFrom,
          dateTo: logDateTo
        };
        const appliedColumns = options?.columns ?? exportColumns;
        const appliedEncoding = options?.encoding ?? exportEncoding;
        const query = buildAuditLogsQuery(100, appliedFilters);
        const data = await apiGet<{ items: AuditItem[] }>(
          `/api/audit-logs/reviews?${query}`
        );
        if (data.items.length === 0) {
          setError("当前无可导出的日志");
          return;
        }

        const columns: Array<{
          key: ExportColumn;
          title: string;
          value: (item: AuditItem) => string;
        }> = [
          { key: "time", title: "时间", value: (item) => formatLogTime(item.createdAt) },
          {
            key: "actor",
            title: "审批人",
            value: (item) => item.actor?.realName || item.actor?.username || "未知审批人"
          },
          {
            key: "action",
            title: "动作",
            value: (item) => (item.action === "REVIEW_APPROVED" ? "通过" : "驳回")
          },
          { key: "targetId", title: "周报ID", value: (item) => `#${item.targetId}` }
        ];
        const selectedColumns = columns.filter((col) => appliedColumns[col.key]);
        if (selectedColumns.length === 0) {
          setError("请至少选择一个导出字段");
          return;
        }

        const header = selectedColumns.map((col) => col.title);
        const rows = data.items.map((item) => {
          return selectedColumns.map((col) => col.value(item));
        });
        const csvContent = [header, ...rows]
          .map((line) => line.map((cell) => toCsvCell(cell)).join(","))
          .join("\n");
        const prefix = appliedEncoding === "utf-8" ? "﻿" : "";
        const finalContent = `${prefix}${csvContent}`;
        const mimeType = `text/csv;charset=${appliedEncoding};`;
        const blob = new Blob([finalContent], {
          type: mimeType
        });
        const datePart = appliedFilters.dateFrom || appliedFilters.dateTo
          ? `${appliedFilters.dateFrom || "start"}_to_${appliedFilters.dateTo || "today"}`
          : "all";
        const encodingSuffix = appliedEncoding === "gbk" ? "-gbk" : "";
        const fileName = `approval-logs-${datePart}${encodingSuffix}.csv`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setExportHistory((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            fileName,
            createdAt: new Date().toISOString(),
            content: finalContent,
            mimeType,
            filters: appliedFilters,
            columns: appliedColumns,
            encoding: appliedEncoding
          },
          ...prev
        ].slice(0, 10));
      } catch {
        setError("导出失败，请稍后重试");
      }
    };
    void doExport();
  };

  const reDownloadHistory = (item: ExportHistoryItem) => {
    const blob = new Blob([item.content], {
      type: item.mimeType
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = item.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const removeHistoryItem = (id: string) => {
    setExportHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const clearHistory = () => {
    setExportHistory([]);
  };

  const reuseHistoryExport = (item: ExportHistoryItem) => {
    const filters = item.filters ?? {};
    const columns = item.columns ?? exportColumns;
    const encoding = item.encoding ?? exportEncoding;
    setLogDecision((filters.decision ?? "all") as "all" | "APPROVED" | "REJECTED");
    setLogActorKeyword(filters.actorKeyword ?? "");
    setLogDateFrom(filters.dateFrom ?? "");
    setLogDateTo(filters.dateTo ?? "");
    setExportColumns(columns);
    setExportEncoding(encoding);
    exportLogsCsv({
      filters,
      columns,
      encoding
    });
  };

  const saveCurrentAsTemplate = () => {
    const name = templateName.trim();
    if (!name) {
      setError("请填写模板名称");
      return;
    }
    const currentFilters = {
      decision: logDecision,
      actorKeyword: logActorKeyword.trim(),
      dateFrom: logDateFrom,
      dateTo: logDateTo
    };
    const existed = exportTemplates.find((item) => item.name === name);
    const nextTemplate: ExportTemplate = existed
      ? {
          ...existed,
          filters: currentFilters,
          columns: exportColumns,
          diffExportMaskSensitive: maskSensitiveInDiffExport,
          encoding: exportEncoding,
          createdAt: new Date().toISOString()
        }
      : {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name,
          createdAt: new Date().toISOString(),
          pinned: false,
          filters: currentFilters,
          columns: exportColumns,
          diffExportMaskSensitive: maskSensitiveInDiffExport,
          encoding: exportEncoding
        };

    updateExportTemplates((prev) => {
      const remained = prev.filter((item) => item.id !== nextTemplate.id);
      return [nextTemplate, ...remained].slice(0, 20);
    });

    const run = async () => {
      try {
        const data = await apiPost<{ item: ExportTemplate }, { ownerUserId?: number; item: ExportTemplate }>(
          "/api/audit-logs/review-templates",
          {
            ownerUserId: ownerUserIdAsNumber(),
            item: nextTemplate
          }
        );
        if (!data?.item) {
          return;
        }
        updateExportTemplates((prev) => {
          const remained = prev.filter(
            (item) => item.id !== data.item.id && item.name !== data.item.name
          );
          return [data.item, ...remained].slice(0, 20);
        });
      } catch {
        // Keep optimistic local state when save API fails.
      }
    };
    void run();
  };

  const togglePinTemplate = (id: string) => {
    const target = exportTemplates.find((item) => item.id === id);
    if (!target) {
      return;
    }
    const nextPinned = !target.pinned;
    updateExportTemplates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pinned: nextPinned } : item))
    );
    const run = async () => {
      try {
        await apiPost("/api/audit-logs/review-templates", {
          ownerUserId: ownerUserIdAsNumber(),
          item: {
            ...target,
            pinned: nextPinned
          }
        });
      } catch {
        // Keep optimistic local state when pin API fails.
      }
    };
    void run();
  };

  const toggleTemplateDiffMaskDefault = (id: string) => {
    const target = exportTemplates.find((item) => item.id === id);
    if (!target) {
      return;
    }
    const current =
      typeof target.diffExportMaskSensitive === "boolean"
        ? target.diffExportMaskSensitive
        : maskSensitiveInDiffExport;
    const next = !current;
    let confirmed = true;
    try {
      const result = window.confirm(`确认将模板差异TXT默认改为${next ? "脱敏" : "原文"}吗？`);
      confirmed = result !== false;
    } catch {
      confirmed = true;
    }
    if (!confirmed) {
      return;
    }
    updateExportTemplates((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              diffExportMaskSensitive: next
            }
          : item
      )
    );
    setNotice(`模板差异TXT默认已更新为${next ? "脱敏" : "原文"}`);
    const run = async () => {
      try {
        await apiPost("/api/audit-logs/review-templates", {
          ownerUserId: ownerUserIdAsNumber(),
          item: {
            ...target,
            diffExportMaskSensitive: next
          }
        });
      } catch {
        // Keep optimistic local state when update API fails.
      }
    };
    void run();
  };

  const applyTemplateExport = (template: ExportTemplate) => {
    setTemplateName(template.name);
    setLogDecision((template.filters.decision ?? "all") as "all" | "APPROVED" | "REJECTED");
    setLogActorKeyword(template.filters.actorKeyword ?? "");
    setLogDateFrom(template.filters.dateFrom ?? "");
    setLogDateTo(template.filters.dateTo ?? "");
    setExportColumns(template.columns);
    setExportEncoding(template.encoding);
    if (typeof template.diffExportMaskSensitive === "boolean") {
      setMaskSensitiveInDiffExport(template.diffExportMaskSensitive);
    }
    exportLogsCsv({
      filters: template.filters,
      columns: template.columns,
      encoding: template.encoding
    });
  };

  const renameTemplate = (id: string, fallbackName: string) => {
    const nextName = (templateRenameMap[id] ?? "").trim();
    if (!nextName) {
      setError("请输入新的模板名称");
      return;
    }
    updateExportTemplates((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name: nextName,
              createdAt: new Date().toISOString()
            }
          : item
      )
    );
    const run = async () => {
      try {
        const data = await apiPatch<{ item: ExportTemplate }, { ownerUserId?: number; item: { name: string; createdAt: string } }>(
          `/api/audit-logs/review-templates/${id}`,
          {
            ownerUserId: ownerUserIdAsNumber(),
            item: {
              name: nextName,
              createdAt: new Date().toISOString()
            }
          }
        );
        updateExportTemplates((prev) =>
          prev.map((item) => (item.id === id ? data.item : item))
        );
      } catch {
        // Keep optimistic local state when rename API fails.
      }
    };
    void run();
    setTemplateRenameMap((prev) => {
      const cloned = { ...prev };
      delete cloned[id];
      return cloned;
    });
    if (templateName === fallbackName) {
      setTemplateName(nextName);
    }
  };

  const removeTemplate = (id: string) => {
    updateExportTemplates((prev) => prev.filter((item) => item.id !== id));
    setTemplateRenameMap((prev) => {
      const cloned = { ...prev };
      delete cloned[id];
      return cloned;
    });
    const run = async () => {
      try {
        const query = buildTemplateOwnerQuery();
        await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/audit-logs/review-templates/${id}${query}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${window.localStorage.getItem("accessToken") ?? ""}`
            }
          }
        );
      } catch {
        // Keep optimistic local state when delete API fails.
      }
    };
    void run();
  };

  const exportTemplatesAsJson = () => {
    const exportPayload = exportTemplates.map((item) => ({
      ...item,
      diffExportMaskSensitive:
        typeof item.diffExportMaskSensitive === "boolean"
          ? item.diffExportMaskSensitive
          : maskSensitiveInDiffExport
    }));
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "export-templates.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseImportTemplates = (raw: string): ExportTemplate[] => {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("模板JSON格式不正确：根节点必须是数组");
    }

    const normalized: ExportTemplate[] = [];
    parsed.forEach((item, index) => {
      const line = `第 ${index + 1} 条`;
      if (!item || typeof item !== "object") {
        throw new Error(`模板JSON格式不正确：${line}必须是对象`);
      }
      const maybe = item as Partial<ExportTemplate>;
      const name = typeof maybe.name === "string" ? maybe.name.trim() : "";
      if (!name) {
        throw new Error(`模板JSON格式不正确：${line}缺少 name`);
      }
      if (
        maybe.filters?.decision &&
        maybe.filters.decision !== "all" &&
        maybe.filters.decision !== "APPROVED" &&
        maybe.filters.decision !== "REJECTED"
      ) {
        throw new Error(`模板JSON格式不正确：${line}的 decision 非法`);
      }
      normalized.push({
        id: maybe.id || `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
        name,
        createdAt: maybe.createdAt || new Date().toISOString(),
        pinned: Boolean(maybe.pinned),
        filters: {
          decision:
            maybe.filters?.decision === "APPROVED" || maybe.filters?.decision === "REJECTED"
              ? maybe.filters.decision
              : "all",
          actorKeyword: maybe.filters?.actorKeyword ?? "",
          dateFrom: maybe.filters?.dateFrom ?? "",
          dateTo: maybe.filters?.dateTo ?? ""
        },
        columns: {
          time: maybe.columns?.time ?? DEFAULT_EXPORT_COLUMNS.time,
          actor: maybe.columns?.actor ?? DEFAULT_EXPORT_COLUMNS.actor,
          action: maybe.columns?.action ?? DEFAULT_EXPORT_COLUMNS.action,
          targetId: maybe.columns?.targetId ?? DEFAULT_EXPORT_COLUMNS.targetId
        },
        diffExportMaskSensitive:
          typeof maybe.diffExportMaskSensitive === "boolean"
            ? maybe.diffExportMaskSensitive
            : undefined,
        encoding: maybe.encoding === "gbk" ? "gbk" : "utf-8"
      });
    });
    if (normalized.length === 0) {
      throw new Error("模板JSON中没有可导入的模板");
    }
    return normalized;
  };

  const applyImportedTemplates = (
    imported: ExportTemplate[],
    strategy: "overwrite" | "skip"
  ) => {
    const nextTemplates = (() => {
      const mergedByName = new Map<string, ExportTemplate>();
      exportTemplates.forEach((item) => mergedByName.set(item.name, item));
      imported.forEach((item) => {
        if (strategy === "skip" && mergedByName.has(item.name)) {
          return;
        }
        mergedByName.set(item.name, item);
      });
      return [...mergedByName.values()]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20);
    })();
    updateExportTemplates(nextTemplates);
    setPendingImportTemplates(null);
    setPendingDuplicateCount(0);
    setError("");
    const run = async () => {
      try {
        await apiPost("/api/audit-logs/review-templates/sync", {
          ownerUserId: ownerUserIdAsNumber(),
          items: nextTemplates
        });
      } catch {
        // Keep optimistic local state when bulk import API fails.
      }
    };
    void run();
  };

  const importTemplatesFromJson = () => {
    const raw = templateJsonText.trim();
    if (!raw) {
      setError("请输入模板JSON内容");
      return;
    }

    try {
      const normalized = parseImportTemplates(raw);
      const currentNames = new Set(exportTemplates.map((item) => item.name));
      const duplicateCount = normalized.filter((item) => currentNames.has(item.name)).length;
      if (duplicateCount > 0) {
        setPendingImportTemplates(normalized);
        setPendingDuplicateCount(duplicateCount);
        setError("");
        return;
      }
      applyImportedTemplates(normalized, "overwrite");
    } catch (err) {
      const message = err instanceof Error ? err.message : "模板JSON格式不正确";
      setError(message);
      setPendingImportTemplates(null);
      setPendingDuplicateCount(0);
    }
  };

  const loadTemplateVersions = (templateId: string) => {
    setTemplateVersionLoadingId(templateId);
    const run = async () => {
      try {
        const data = await apiGet<{ items: TemplateVersion[] }>(
          `/api/audit-logs/review-templates/${templateId}/versions${buildTemplateOwnerQuery()}`
        );
        setTemplateVersions((prev) => ({
          ...prev,
          [templateId]: data.items
        }));
      } catch {
        setError("加载模板版本失败");
      } finally {
        setTemplateVersionLoadingId("");
      }
    };
    void run();
  };

  const rollbackTemplate = (templateId: string, versionId: number) => {
    let confirmed = true;
    try {
      const result = window.confirm("确认回滚到该版本吗？当前模板配置会被覆盖。");
      confirmed = result !== false;
    } catch {
      confirmed = true;
    }
    if (!confirmed) {
      return;
    }
    const run = async () => {
      try {
        const data = await apiPost<
          { item: ExportTemplate },
          { ownerUserId?: number; versionId: number }
        >(`/api/audit-logs/review-templates/${templateId}/rollback`, {
          ownerUserId: ownerUserIdAsNumber(),
          versionId
        });
        updateExportTemplates((prev) =>
          prev.map((item) => (item.id === templateId ? data.item : item))
        );
        await loadTemplatesFromServer();
        loadTemplateVersions(templateId);
      } catch {
        setError("模板回滚失败");
      }
    };
    void run();
  };

  const formatHistoryTime = (value: string) =>
    new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  const buildTemplateDiffSummary = (current: ExportTemplate, version: TemplateVersion) => {
    const diffs: string[] = [];
    if (current.name !== version.name) {
      diffs.push("名称");
    }
    if (current.pinned !== version.pinned) {
      diffs.push("置顶");
    }
    if (JSON.stringify(current.filters) !== JSON.stringify(version.filters)) {
      diffs.push("筛选条件");
    }
    if (JSON.stringify(current.columns) !== JSON.stringify(version.columns)) {
      diffs.push("导出字段");
    }
    if (current.encoding !== version.encoding) {
      diffs.push("编码");
    }
    return diffs.length > 0 ? diffs.join("、") : "与当前一致";
  };
  const buildTemplateDiffDetails = (current: ExportTemplate, version: TemplateVersion) => {
    const details: Array<{ label: string; current: string; history: string }> = [];
    if (current.name !== version.name) {
      details.push({
        label: "名称",
        current: current.name,
        history: version.name
      });
    }
    if (current.pinned !== version.pinned) {
      details.push({
        label: "置顶",
        current: current.pinned ? "是" : "否",
        history: version.pinned ? "是" : "否"
      });
    }
    const currentFilters = JSON.stringify(current.filters);
    const historyFilters = JSON.stringify(version.filters);
    if (currentFilters !== historyFilters) {
      details.push({
        label: "筛选条件",
        current: formatTemplateFilters(current.filters),
        history: formatTemplateFilters(version.filters)
      });
    }
    const currentColumns = JSON.stringify(current.columns);
    const historyColumns = JSON.stringify(version.columns);
    if (currentColumns !== historyColumns) {
      details.push({
        label: "导出字段",
        current: formatTemplateColumns(current.columns),
        history: formatTemplateColumns(version.columns)
      });
    }
    if (current.encoding !== version.encoding) {
      details.push({
        label: "编码",
        current: current.encoding,
        history: version.encoding
      });
    }
    const priority: Record<string, number> = {
      编码: 1,
      筛选条件: 2,
      导出字段: 3,
      名称: 4,
      置顶: 5
    };
    return details.sort((a, b) => (priority[a.label] ?? 99) - (priority[b.label] ?? 99));
  };
  const copyTemplateDiffDetails = (template: ExportTemplate, version: TemplateVersion) => {
    const lines = buildTemplateDiffLines(template, version);
    const run = async () => {
      try {
        if (!navigator?.clipboard?.writeText) {
          throw new Error("clipboard unavailable");
        }
        await navigator.clipboard.writeText(lines.join("\n"));
        setNotice("差异内容已复制");
      } catch {
        setError("复制失败，请检查浏览器权限");
      }
    };
    void run();
  };
  const maskKeyword = (value: string) => {
    const normalized = value.trim();
    if (!normalized || normalized === "无") {
      return "无";
    }
    if (normalized.length === 1) {
      return "*";
    }
    return `${normalized[0]}${"*".repeat(normalized.length - 1)}`;
  };
  const maskFilterKeywordInDetail = (value: string) =>
    value.replace(/审批人关键词：([^，\n]+)/g, (_matched, keyword: string) => {
      return `审批人关键词：${maskKeyword(keyword)}`;
    });
  const buildTemplateDiffLines = (
    template: ExportTemplate,
    version: TemplateVersion,
    options?: { maskSensitive?: boolean }
  ) => [
    `模板：${template.name}`,
    `版本：#${version.id}`,
    ...buildTemplateDiffDetails(template, version).flatMap((detail) => [
      `字段：${detail.label}`,
      `当前：${
        options?.maskSensitive && detail.label === "筛选条件"
          ? maskFilterKeywordInDetail(detail.current)
          : detail.current
      }`,
      `历史：${
        options?.maskSensitive && detail.label === "筛选条件"
          ? maskFilterKeywordInDetail(detail.history)
          : detail.history
      }`
    ])
  ];
  const buildTemplateDiffExportText = (
    template: ExportTemplate,
    version: TemplateVersion,
    maskSensitive: boolean
  ) => {
    const header = [
      `导出时间：${new Date().toLocaleString("zh-CN")}`,
      `模板ID：${template.id}`,
      `模板名称：${template.name}`,
      `版本ID：${version.id}`,
      `敏感信息处理：${maskSensitive ? "已脱敏" : "原文"}`
    ];
    return [
      ...header,
      "",
      ...buildTemplateDiffLines(template, version, { maskSensitive })
    ].join("\n");
  };
  const exportTemplateDiffDetailsTxt = (template: ExportTemplate, version: TemplateVersion) => {
    try {
      const effectiveMaskSensitive =
        typeof template.diffExportMaskSensitive === "boolean"
          ? template.diffExportMaskSensitive
          : maskSensitiveInDiffExport;
      const blob = new Blob(
        [buildTemplateDiffExportText(template, version, effectiveMaskSensitive)],
        {
          type: "text/plain;charset=utf-8"
        }
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `template-diff-${template.id}-v${version.id}.txt`;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setNotice("差异TXT已导出");
    } catch {
      setError("导出差异TXT失败，请稍后重试");
    }
  };
  const filteredHistory = exportHistory.filter((item) =>
    item.fileName.toLowerCase().includes(historyQuery.trim().toLowerCase())
  );
  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (historySortBy === "fileName") {
      const cmp = a.fileName.localeCompare(b.fileName, "zh-CN");
      return historySortDir === "asc" ? cmp : -cmp;
    }
    const cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return historySortDir === "asc" ? cmp : -cmp;
  });
  const historyPageCount = Math.max(
    1,
    Math.ceil(sortedHistory.length / EXPORT_HISTORY_PAGE_SIZE)
  );
  const safeHistoryPage = Math.min(historyPage, historyPageCount);
  const pagedHistory = sortedHistory.slice(
    (safeHistoryPage - 1) * EXPORT_HISTORY_PAGE_SIZE,
    safeHistoryPage * EXPORT_HISTORY_PAGE_SIZE
  );
  const sortedTemplates = [...exportTemplates].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const filteredTemplates = sortedTemplates.filter((item) =>
    item.name.toLowerCase().includes(templateQuery.trim().toLowerCase())
  );

  const approvedLogCount = logs.filter((log) => log.action === "REVIEW_APPROVED").length;
  const rejectedLogCount = logs.filter((log) => log.action === "REVIEW_REJECTED").length;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const getRangeBounds = (range: "today" | "7d" | "month") => {
    if (range === "today") {
      return {
        start: todayStart,
        end: tomorrowStart,
        prevStart: new Date(todayStart.getTime() - 24 * 60 * 60 * 1000),
        prevEnd: todayStart,
        label: "今日审批"
      };
    }
    if (range === "7d") {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 6);
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      return {
        start,
        end: tomorrowStart,
        prevStart,
        prevEnd: start,
        label: "近7天审批"
      };
    }
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      start: monthStart,
      end: nextMonthStart,
      prevStart: prevMonthStart,
      prevEnd: monthStart,
      label: "本月审批"
    };
  };

  const countInRange = (start: Date, end: Date) =>
    logs.filter((log) => {
      const t = new Date(log.createdAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    }).length;

  const rangeBounds = getRangeBounds(statsRange);
  const currentRangeCount = countInRange(rangeBounds.start, rangeBounds.end);
  const previousRangeCount = countInRange(rangeBounds.prevStart, rangeBounds.prevEnd);
  const rangeDelta = currentRangeCount - previousRangeCount;
  const trendArrow = rangeDelta > 0 ? "↑" : rangeDelta < 0 ? "↓" : "→";
  const trendPercent =
    previousRangeCount === 0
      ? currentRangeCount === 0
        ? 0
        : 100
      : Math.round((Math.abs(rangeDelta) / previousRangeCount) * 100);
  const rangeTrendText = `${trendArrow} ${trendPercent}%`;
  const formatLogTime = (value: string) =>
    new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

  return (
    <main className="reviews-page">
      <div className="reviews-toolbar">
        <div className="reviews-title-block">
          <h1>待我审批</h1>
          <p className="reviews-subtitle">优先处理超期单，批量操作可显著提升提交率与审批效率</p>
        </div>
        <button type="button" onClick={() => logoutWithConfirm()}>
          退出登录
        </button>
      </div>
      <SessionExpiryNotice />
      <nav className="reviews-quick-nav" aria-label="审批快捷导航">
        <a href="#pending-list">待审列表</a>
        <a href="#templates">导出模板</a>
        <a href="#logs">操作日志</a>
        <a href="#exports">导出任务</a>
        <a href="/manager/performance">绩效占位</a>
      </nav>
      {loading ? <p>加载中...</p> : null}
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--primary-strong)" }}>{notice}</p> : null}
      <section className="reviews-stat-grid">
        <article className="reviews-stat-card">
          <div className="reviews-stat-label">待审批总数</div>
          <strong className="reviews-stat-value">{items.length}</strong>
        </article>
        <article style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
          <div className="reviews-stat-label">已选择</div>
          <strong className="reviews-stat-value">{selectedIds.length}</strong>
        </article>
        <article style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
          <div className="reviews-stat-label">最近审批</div>
          <strong className="reviews-stat-value">
            通过 {approvedLogCount} / 驳回 {rejectedLogCount}
          </strong>
        </article>
        <article style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
          <div className="reviews-stat-label">{rangeBounds.label}</div>
          <strong className="reviews-stat-value" data-testid="stats-range-count">
            {currentRangeCount}
          </strong>
          <div
            style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px" }}
            data-testid="stats-range-trend"
          >
            {rangeTrendText}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setStatsRange("today")}>
              今日
            </button>
            <button type="button" onClick={() => setStatsRange("7d")}>
              近7天
            </button>
            <button type="button" onClick={() => setStatsRange("month")}>
              本月
            </button>
          </div>
        </article>
      </section>
      {!loading && !error && items.length === 0 ? <p>当前没有待审批周报。</p> : null}
      {!loading && !error && items.length > 0 ? (
        <>
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <button type="button" onClick={() => setSelectedIds(items.map((item) => item.id))}>
              全选
            </button>
            <button type="button" onClick={() => setSelectedIds([])}>
              取消全选
            </button>
            <button type="button" onClick={() => void reviewMany(selectedIds, "APPROVED")}>
              批量通过
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                if (selectedIds.length === 0) {
                  setError("请至少选择一条周报");
                  return;
                }
                setRejectTargetIds(selectedIds);
              }}
            >
              批量驳回
            </button>
          </div>
          <ul id="pending-list" style={{ display: "grid", gap: "12px", padding: 0, listStyle: "none" }}>
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "14px"
                }}
              >
                <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    aria-label={`选择周报-${item.id}`}
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => toggleSelected(item.id, event.target.checked)}
                  />
                  <strong>#{item.id}</strong> {item.thisWeekText}
                </label>
                <div style={{ color: "var(--muted)", marginTop: "6px" }}>
                  状态: {item.status}
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button type="button" onClick={() => void reviewMany([item.id], "APPROVED")}>
                    通过
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setRejectTargetIds([item.id]);
                    }}
                  >
                    驳回
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {rejectTargetIds.length > 0 ? (
        <section
          style={{
            marginTop: "16px",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "12px",
            background: "var(--surface)"
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "16px" }}>
            填写驳回原因（{rejectTargetIds.length} 条）
          </h2>
          <p style={{ marginTop: 0, marginBottom: "6px", color: "var(--muted)" }}>
            将驳回以下周报：
          </p>
          <ul style={{ marginTop: 0, paddingLeft: "18px" }}>
            {items
              .filter((item) => rejectTargetIds.includes(item.id))
              .map((item) => (
                <li key={item.id}>
                  #{item.id} {item.thisWeekText}
                </li>
              ))}
          </ul>
          <textarea
            aria-label="驳回原因"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={3}
            style={{
              width: "100%",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "8px"
            }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button type="button" onClick={() => void confirmReject()}>
              确认驳回
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectTargetIds([]);
                setRejectReason("");
              }}
            >
              取消
            </button>
          </div>
        </section>
      ) : null}
      <section id="templates" style={{ marginTop: "16px", padding: "12px" }}>
        <h2 style={{ marginTop: 0, fontSize: "16px" }}>导出模板</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
          <label>
            <input
              type="checkbox"
              aria-label="导出差异TXT脱敏"
              checked={maskSensitiveInDiffExport}
              onChange={(event) => setMaskSensitiveInDiffExport(event.target.checked)}
            />
            导出差异TXT脱敏
          </label>
          {isSuperAdmin ? (
            <>
              <input
                aria-label="模板用户ID"
                placeholder="用户ID（超级管理员）"
                value={templateOwnerUserId}
                onChange={(event) => setTemplateOwnerUserId(event.target.value)}
              />
              <button
                type="button"
                onClick={() => void loadTemplatesFromServer(undefined, { switching: true })}
              >
                切换用户模板
              </button>
            </>
          ) : null}
          <input
            aria-label="模板名称"
            placeholder="输入模板名称"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
          />
          <input
            aria-label="模板搜索"
            placeholder="搜索模板"
            value={templateQuery}
            onChange={(event) => setTemplateQuery(event.target.value)}
          />
          <button type="button" onClick={saveCurrentAsTemplate}>
            收藏当前配置为模板
          </button>
          <button type="button" onClick={exportTemplatesAsJson}>
            导出模板JSON
          </button>
          <button type="button" onClick={importTemplatesFromJson}>
            导入模板JSON
          </button>
        </div>
        <textarea
          aria-label="模板JSON内容"
          placeholder="粘贴模板 JSON 数组"
          value={templateJsonText}
          onChange={(event) => {
            setTemplateJsonText(event.target.value);
            if (pendingImportTemplates) {
              setPendingImportTemplates(null);
              setPendingDuplicateCount(0);
            }
          }}
          rows={4}
          style={{
            width: "100%",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "8px",
            marginBottom: "8px"
          }}
        />
        <p style={{ marginTop: 0, marginBottom: "8px", color: "var(--muted)" }}>
          模板JSON字段说明：diffExportMaskSensitive=true（脱敏）、false（原文）
        </p>
        {pendingImportTemplates && pendingDuplicateCount > 0 ? (
          <div style={{ marginBottom: "8px" }}>
            <p style={{ marginTop: 0 }}>
              检测到 {pendingDuplicateCount} 个同名模板
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => applyImportedTemplates(pendingImportTemplates, "overwrite")}
              >
                覆盖同名并导入
              </button>
              <button
                type="button"
                onClick={() => applyImportedTemplates(pendingImportTemplates, "skip")}
              >
                跳过同名并导入
              </button>
            </div>
          </div>
        ) : null}
        {templateSwitching ? (
          <p style={{ marginTop: 0, marginBottom: "8px" }}>正在切换模板用户...</p>
        ) : null}
        {!templateSwitching &&
        isSuperAdmin &&
        templateSwitchedOwner &&
        filteredTemplates.length === 0 ? (
          <p style={{ marginTop: 0, marginBottom: "8px" }}>该用户暂无模板</p>
        ) : null}
        {filteredTemplates.length === 0 ? <p style={{ margin: 0 }}>暂无模板</p> : null}
        {filteredTemplates.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {filteredTemplates.map((template) => (
              <li key={template.id} data-testid="export-template-item">
                <strong>{template.name}</strong>{" "}
                {template.pinned ? <span style={{ color: "var(--primary-strong)" }}>[已置顶]</span> : null}{" "}
                <span style={{ color: "var(--muted)" }}>
                  差异TXT默认：
                  {typeof template.diffExportMaskSensitive === "boolean"
                    ? template.diffExportMaskSensitive
                      ? "脱敏"
                      : "原文"
                    : maskSensitiveInDiffExport
                      ? "脱敏（跟随全局）"
                      : "原文（跟随全局）"}
                </span>{" "}
                <button
                  type="button"
                  aria-label={`切换模板脱敏默认-${template.name}`}
                  onClick={() => toggleTemplateDiffMaskDefault(template.id)}
                >
                  {(() => {
                    const current =
                      typeof template.diffExportMaskSensitive === "boolean"
                        ? template.diffExportMaskSensitive
                        : maskSensitiveInDiffExport;
                    return current ? "设为原文" : "设为脱敏";
                  })()}
                </button>{" "}
                <button
                  type="button"
                  aria-label={`置顶模板-${template.name}`}
                  onClick={() => togglePinTemplate(template.id)}
                >
                  {template.pinned ? "取消置顶" : "置顶"}
                </button>{" "}
                <button
                  type="button"
                  aria-label={`应用模板并导出-${template.name}`}
                  onClick={() => applyTemplateExport(template)}
                >
                  应用模板并导出
                </button>
                {" "}
                <button
                  type="button"
                  aria-label={`查看模板版本-${template.name}`}
                  onClick={() => loadTemplateVersions(template.id)}
                >
                  {templateVersionLoadingId === template.id ? "加载中..." : "历史版本"}
                </button>
                {" "}
                <input
                  aria-label={`模板新名称-${template.name}`}
                  placeholder="新名称"
                  value={templateRenameMap[template.id] ?? ""}
                  onChange={(event) =>
                    setTemplateRenameMap((prev) => ({
                      ...prev,
                      [template.id]: event.target.value
                    }))
                  }
                />
                {" "}
                <button
                  type="button"
                  aria-label={`重命名模板-${template.name}`}
                  onClick={() => renameTemplate(template.id, template.name)}
                >
                  重命名
                </button>
                {" "}
                <button
                  type="button"
                  aria-label={`删除模板-${template.name}`}
                  onClick={() => removeTemplate(template.id)}
                >
                  删除模板
                </button>
                {templateVersions[template.id]?.length ? (
                  <ul style={{ marginTop: "6px", marginBottom: 0 }}>
                    {templateVersions[template.id].map((version) => (
                      <li key={version.id}>
                        版本#{version.id}（{formatHistoryTime(version.createdAt)}）{" "}
                        <span style={{ color: "var(--muted)" }}>
                          与当前差异：{buildTemplateDiffSummary(template, version)}
                        </span>{" "}
                        <button
                          type="button"
                          aria-label={`复制差异详情-${template.name}-${version.id}`}
                          onClick={() => copyTemplateDiffDetails(template, version)}
                        >
                          复制差异
                        </button>{" "}
                        <button
                          type="button"
                          aria-label={`导出差异详情TXT-${template.name}-${version.id}`}
                          onClick={() => exportTemplateDiffDetailsTxt(template, version)}
                        >
                          导出差异TXT
                        </button>{" "}
                        <button
                          type="button"
                          aria-label={`查看差异详情-${template.name}-${version.id}`}
                          onClick={() =>
                            setTemplateVersionDiffOpenMap((prev) => ({
                              ...prev,
                              [`${template.id}-${version.id}`]:
                                !prev[`${template.id}-${version.id}`]
                            }))
                          }
                        >
                          {templateVersionDiffOpenMap[`${template.id}-${version.id}`]
                            ? "收起差异详情"
                            : "查看差异详情"}
                        </button>{" "}
                        <button
                          type="button"
                          aria-label={`回滚模板版本-${template.name}-${version.id}`}
                          onClick={() => rollbackTemplate(template.id, version.id)}
                        >
                          回滚到该版本
                        </button>
                        {templateVersionDiffOpenMap[`${template.id}-${version.id}`] ? (
                          <ul style={{ marginTop: "4px", marginBottom: 0 }}>
                            {buildTemplateDiffDetails(template, version).map((detail) => (
                              <li
                                key={detail.label}
                                data-testid={`template-diff-row-${template.id}-${version.id}-${detail.label}`}
                                style={{
                                  background: "rgba(25, 118, 210, 0.08)",
                                  border: "1px solid rgba(25, 118, 210, 0.28)",
                                  borderRadius: "8px",
                                  padding: "6px"
                                }}
                              >
                                <div>字段：{detail.label}</div>
                                <div>
                                  当前：
                                  {(() => {
                                    const expandKey = `${template.id}-${version.id}-${detail.label}-current`;
                                    const expanded = Boolean(templateDiffValueExpandMap[expandKey]);
                                    const needsCollapse = detail.current.length > DIFF_VALUE_PREVIEW_MAX;
                                    const displayed =
                                      needsCollapse && !expanded
                                        ? `${detail.current.slice(0, DIFF_VALUE_PREVIEW_MAX)}...`
                                        : detail.current;
                                    return (
                                      <>
                                        {displayed}
                                        {needsCollapse ? (
                                          <>
                                            {" "}
                                            <button
                                              type="button"
                                              aria-label={`${
                                                expanded ? "收起" : "展开"
                                              }差异值-${template.name}-${version.id}-${detail.label}-current`}
                                              onClick={() =>
                                                setTemplateDiffValueExpandMap((prev) => ({
                                                  ...prev,
                                                  [expandKey]: !prev[expandKey]
                                                }))
                                              }
                                            >
                                              {expanded ? "收起" : "展开"}
                                            </button>
                                          </>
                                        ) : null}
                                      </>
                                    );
                                  })()}
                                </div>
                                <div>
                                  历史：
                                  {(() => {
                                    const expandKey = `${template.id}-${version.id}-${detail.label}-history`;
                                    const expanded = Boolean(templateDiffValueExpandMap[expandKey]);
                                    const needsCollapse = detail.history.length > DIFF_VALUE_PREVIEW_MAX;
                                    const displayed =
                                      needsCollapse && !expanded
                                        ? `${detail.history.slice(0, DIFF_VALUE_PREVIEW_MAX)}...`
                                        : detail.history;
                                    return (
                                      <>
                                        {displayed}
                                        {needsCollapse ? (
                                          <>
                                            {" "}
                                            <button
                                              type="button"
                                              aria-label={`${
                                                expanded ? "收起" : "展开"
                                              }差异值-${template.name}-${version.id}-${detail.label}-history`}
                                              onClick={() =>
                                                setTemplateDiffValueExpandMap((prev) => ({
                                                  ...prev,
                                                  [expandKey]: !prev[expandKey]
                                                }))
                                              }
                                            >
                                              {expanded ? "收起" : "展开"}
                                            </button>
                                          </>
                                        ) : null}
                                      </>
                                    );
                                  })()}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section id="logs" style={{ marginTop: "16px", padding: "12px" }}>
        <h2 style={{ marginTop: 0, fontSize: "16px" }}>操作日志</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
          <label>
            结果：
            <select
              aria-label="日志结果筛选"
              value={logDecision}
              onChange={(event) =>
                setLogDecision(event.target.value as "all" | "APPROVED" | "REJECTED")
              }
              style={{ marginLeft: "6px" }}
            >
              <option value="all">全部</option>
              <option value="APPROVED">仅通过</option>
              <option value="REJECTED">仅驳回</option>
            </select>
          </label>
          <label>
            审批人：
            <input
              aria-label="日志审批人筛选"
              value={logActorKeyword}
              onChange={(event) => setLogActorKeyword(event.target.value)}
              placeholder="姓名或账号"
              style={{ marginLeft: "6px" }}
            />
          </label>
          <label>
            开始：
            <input
              aria-label="日志开始日期筛选"
              type="date"
              value={logDateFrom}
              onChange={(event) => setLogDateFrom(event.target.value)}
              style={{ marginLeft: "6px" }}
            />
          </label>
          <label>
            结束：
            <input
              aria-label="日志结束日期筛选"
              type="date"
              value={logDateTo}
              onChange={(event) => setLogDateTo(event.target.value)}
              style={{ marginLeft: "6px" }}
            />
          </label>
          <button type="button" onClick={() => void loadAuditLogs()}>
            筛选日志
          </button>
          <button type="button" onClick={() => applyExportPreset("retro")}>
            复盘版预设
          </button>
          <button type="button" onClick={() => applyExportPreset("audit")}>
            审计版预设
          </button>
          <span style={{ color: "var(--muted)" }}>导出字段：</span>
          <label>
            <input
              aria-label="导出字段-时间"
              type="checkbox"
              checked={exportColumns.time}
              onChange={(event) =>
                setExportColumns((prev) => ({ ...prev, time: event.target.checked }))
              }
            />
            时间
          </label>
          <label>
            <input
              aria-label="导出字段-审批人"
              type="checkbox"
              checked={exportColumns.actor}
              onChange={(event) =>
                setExportColumns((prev) => ({ ...prev, actor: event.target.checked }))
              }
            />
            审批人
          </label>
          <label>
            <input
              aria-label="导出字段-动作"
              type="checkbox"
              checked={exportColumns.action}
              onChange={(event) =>
                setExportColumns((prev) => ({ ...prev, action: event.target.checked }))
              }
            />
            动作
          </label>
          <label>
            <input
              aria-label="导出字段-周报ID"
              type="checkbox"
              checked={exportColumns.targetId}
              onChange={(event) =>
                setExportColumns((prev) => ({ ...prev, targetId: event.target.checked }))
              }
            />
            周报ID
          </label>
          <label>
            编码：
            <select
              aria-label="导出编码"
              value={exportEncoding}
              onChange={(event) => setExportEncoding(event.target.value as "utf-8" | "gbk")}
              style={{ marginLeft: "6px" }}
            >
              <option value="utf-8">UTF-8</option>
              <option value="gbk">GBK</option>
            </select>
          </label>
          <button type="button" onClick={() => exportLogsCsv()}>
            导出CSV
          </button>
        </div>
        {logs.length === 0 ? <p style={{ margin: 0 }}>暂无操作日志</p> : null}
        {logs.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {logs.map((item) => {
              const actionText = item.action === "REVIEW_APPROVED" ? "通过" : "驳回";
              const actorName = item.actor?.realName || item.actor?.username || "未知审批人";
              return (
                <li key={item.id}>
                  {actorName} {actionText}周报 #{item.targetId}（{formatLogTime(item.createdAt)}）
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
      <section id="exports" style={{ marginTop: "16px", padding: "12px" }}>
        <h2 style={{ marginTop: 0, fontSize: "16px" }}>导出任务中心</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
          <input
            aria-label="导出记录搜索"
            placeholder="按文件名搜索"
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
          />
          {sortedHistory.length > 0 ? (
            <>
              <label>
                排序：
                <select
                  aria-label="导出记录排序字段"
                  value={historySortBy}
                  onChange={(event) =>
                    setHistorySortBy(event.target.value as "createdAt" | "fileName")
                  }
                  style={{ marginLeft: "6px" }}
                >
                  <option value="createdAt">时间</option>
                  <option value="fileName">文件名</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  setHistorySortDir((prev) => (prev === "asc" ? "desc" : "asc"))
                }
              >
                切换排序方向
              </button>
              <button
                type="button"
                onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                disabled={safeHistoryPage <= 1}
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() =>
                  setHistoryPage((prev) => Math.min(historyPageCount, prev + 1))
                }
                disabled={safeHistoryPage >= historyPageCount}
              >
                下一页
              </button>
              <span style={{ color: "var(--muted)" }}>
                第 {safeHistoryPage} / {historyPageCount} 页
              </span>
            </>
          ) : null}
        </div>
        {exportHistory.length > 0 ? (
          <div style={{ marginBottom: "8px" }}>
            <button type="button" onClick={clearHistory}>
              清空导出记录
            </button>
          </div>
        ) : null}
        {sortedHistory.length === 0 ? <p style={{ margin: 0 }}>暂无导出记录</p> : null}
        {sortedHistory.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {pagedHistory.map((item) => (
              <li key={item.id}>
                <span>{item.fileName}</span>{" "}
                <span style={{ color: "var(--muted)" }}>（{formatHistoryTime(item.createdAt)}）</span>{" "}
                <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", marginLeft: "6px" }}>
                  {item.filters?.decision && item.filters.decision !== "all" ? (
                    <span>
                      结果: {item.filters.decision === "APPROVED" ? "仅通过" : "仅驳回"}
                    </span>
                  ) : null}
                  {item.filters?.actorKeyword ? (
                    <span>审批人: {item.filters.actorKeyword}</span>
                  ) : null}
                  {item.filters?.dateFrom || item.filters?.dateTo ? (
                    <span>
                      日期: {item.filters?.dateFrom || "start"} ~ {item.filters?.dateTo || "today"}
                    </span>
                  ) : null}
                </div>{" "}
                <button
                  type="button"
                  aria-label={`复用筛选并导出-${item.fileName}`}
                  onClick={() => reuseHistoryExport(item)}
                >
                  复用筛选并导出
                </button>
                {" "}
                <button
                  type="button"
                  aria-label={`重新下载-${item.fileName}`}
                  onClick={() => reDownloadHistory(item)}
                >
                  重新下载
                </button>
                {" "}
                <button
                  type="button"
                  aria-label={`删除记录-${item.fileName}`}
                  onClick={() => removeHistoryItem(item.id)}
                >
                  删除记录
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="reviews-performance-placeholder">
        <h2 style={{ marginTop: 0, fontSize: "16px" }}>绩效考核（占位）</h2>
        <p>当前仅提供结构占位，后续将接入评分规则、周期配置与审批结果联动。</p>
        <p style={{ color: "var(--muted)", fontSize: "12px" }}>可先进入绩效占位页进行字段评审：<a href="/manager/performance">/manager/performance</a></p>
      </section>
    </main>
  );
}
