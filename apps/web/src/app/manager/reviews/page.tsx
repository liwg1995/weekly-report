"use client";

import { useEffect, useState } from "react";
import { ApiClientError, apiGet, apiPatch, apiPost } from "../../../lib/api-client";
import { getSessionUser } from "../../../lib/auth-session";
import AppShell from "../../../components/app-shell";
import PageHeader from "../../../components/page-header";
import ReviewsEfficiencyPanel from "../../../components/reviews-efficiency-panel";
import ResultState from "../../../components/result-state";
import ReviewsOverviewStats from "../../../components/reviews-overview-stats";
import ReviewsPerformancePlaceholder from "../../../components/reviews-performance-placeholder";
import ReviewsQuickNav from "../../../components/reviews-quick-nav";
import ReviewsLogsPanel from "../../../components/reviews-logs-panel";
import ReviewsExportHistoryPanel from "../../../components/reviews-export-history-panel";
import ReviewsTemplatesPanel from "../../../components/reviews-templates-panel";
import ReviewsPendingPanel from "../../../components/reviews-pending-panel";
import ReviewsFilterPanel from "../../../components/reviews-filter-panel";
import SessionExpiryNotice from "../../../components/session-expiry-notice";
import { useAuthGuard } from "../../../lib/use-auth-guard";
import "./reviews.css";

type ReviewItem = {
  id: number;
  thisWeekText: string;
  risksText?: string;
  needsHelpText?: string;
  mentionLeader?: boolean;
  mentionComment?: string;
  status: string;
  dueAt?: string;
  isOverdue?: boolean;
  user?: {
    id: number;
    username: string;
    realName: string;
    leaderUserId?: number | null;
    leader?: {
      id: number;
      username: string;
      realName: string;
    } | null;
  } | null;
};

type ReportListResponse = {
  items: ReviewItem[];
  total?: number;
  page?: number;
  pageSize?: number;
};

type ReviewFilterOptionsResponse = {
  departments: Array<{ id: number; name: string }>;
  leaders: Array<{ id: number; username: string; realName: string }>;
};

type CachedFilterOptions = ReviewFilterOptionsResponse & {
  fetchedAt: string;
};

type AuditItem = {
  id: number;
  action: string;
  targetId: string;
  createdAt: string;
  actor: { id: number; username: string; realName: string } | null;
};

type ReviewNudgeItem = {
  id: number;
  level: string;
  status: string;
  channel: string;
  targetCount: number;
  message: string;
  createdAt: string;
  updatedAt?: string;
};

type ReviewNudgeListResponse = {
  items: ReviewNudgeItem[];
  total?: number;
  page?: number;
  pageSize?: number;
};

type ExportColumn = "time" | "actor" | "action" | "targetId";

const EXPORT_PREFERENCES_KEY = "manager_reviews_export_preferences";
const EXPORT_HISTORY_KEY = "manager_reviews_export_history";
const FILTER_OPTIONS_CACHE_KEY = "manager_reviews_filter_options_cache_v1";
const LIST_FILTER_DEFAULTS_KEY = "manager_reviews_list_filter_defaults_v1";
const FILTER_OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;
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

type ListFilterDefaults = {
  pageSize: number;
  keyword: string;
  departmentId?: number;
  leaderUserId?: number;
  overdueFirst: boolean;
  mentionLeaderOnly: boolean;
  mentionFirst: boolean;
  myDirectOnly: boolean;
};

type ReviewSortMode = "default" | "mentionFirst" | "overdueFirst";

const deriveSortMode = (overdueFirst: boolean, mentionFirst: boolean): ReviewSortMode => {
  if (overdueFirst) {
    return "overdueFirst";
  }
  if (mentionFirst) {
    return "mentionFirst";
  }
  return "default";
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

const readFilterOptionsCache = (): CachedFilterOptions => {
  if (typeof window === "undefined") {
    return { departments: [], leaders: [], fetchedAt: "" };
  }
  try {
    const raw = window.localStorage.getItem(FILTER_OPTIONS_CACHE_KEY);
    if (!raw) {
      return { departments: [], leaders: [], fetchedAt: "" };
    }
    const parsed = JSON.parse(raw) as Partial<CachedFilterOptions>;
    const fetchedAt = String(parsed.fetchedAt ?? "");
    const fetchedAtTs = fetchedAt ? new Date(fetchedAt).getTime() : 0;
    if (!fetchedAtTs || Number.isNaN(fetchedAtTs)) {
      return { departments: [], leaders: [], fetchedAt: "" };
    }
    if (Date.now() - fetchedAtTs > FILTER_OPTIONS_CACHE_TTL_MS) {
      return { departments: [], leaders: [], fetchedAt: "" };
    }
    return {
      departments: Array.isArray(parsed.departments) ? parsed.departments : [],
      leaders: Array.isArray(parsed.leaders) ? parsed.leaders : [],
      fetchedAt
    };
  } catch {
    return { departments: [], leaders: [], fetchedAt: "" };
  }
};

const readListFilterDefaults = (): ListFilterDefaults => {
  const fallback: ListFilterDefaults = {
    pageSize: 20,
    keyword: "",
    departmentId: undefined,
    leaderUserId: undefined,
    overdueFirst: false,
    mentionLeaderOnly: false,
    mentionFirst: false,
    myDirectOnly: false
  };
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(LIST_FILTER_DEFAULTS_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<ListFilterDefaults>;
    const pageSize = Number(parsed.pageSize ?? 20);
    return {
      pageSize: Number.isFinite(pageSize) ? Math.min(100, Math.max(10, pageSize)) : 20,
      keyword: String(parsed.keyword ?? ""),
      departmentId:
        typeof parsed.departmentId === "number" && Number.isFinite(parsed.departmentId)
          ? parsed.departmentId
          : undefined,
      leaderUserId:
        typeof parsed.leaderUserId === "number" && Number.isFinite(parsed.leaderUserId)
          ? parsed.leaderUserId
          : undefined,
      overdueFirst: Boolean(parsed.overdueFirst),
      mentionLeaderOnly: Boolean(parsed.mentionLeaderOnly),
      mentionFirst: Boolean(parsed.mentionFirst),
      myDirectOnly: Boolean(parsed.myDirectOnly)
    };
  } catch {
    return fallback;
  }
};

export default function ManagerReviewsPage() {
  const guard = useAuthGuard({
    currentPath: "/manager/reviews",
    requiredAny: ["reviews:read"]
  });
  const [cachedFilterOptions] = useState<CachedFilterOptions>(() => readFilterOptionsCache());
  const [savedListDefaults, setSavedListDefaults] = useState<ListFilterDefaults>(() =>
    readListFilterDefaults()
  );
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(savedListDefaults.pageSize);
  const [listKeywordInput, setListKeywordInput] = useState(savedListDefaults.keyword);
  const [listKeyword, setListKeyword] = useState(savedListDefaults.keyword);
  const [listDepartmentId, setListDepartmentId] = useState<number | undefined>(
    savedListDefaults.departmentId
  );
  const [listLeaderUserId, setListLeaderUserId] = useState<number | undefined>(
    savedListDefaults.leaderUserId
  );
  const [listOverdueFirst, setListOverdueFirst] = useState(savedListDefaults.overdueFirst);
  const [listMentionLeaderOnly, setListMentionLeaderOnly] = useState(
    savedListDefaults.mentionLeaderOnly
  );
  const [listMentionFirst, setListMentionFirst] = useState(savedListDefaults.mentionFirst);
  const [listSortMode, setListSortMode] = useState<ReviewSortMode>(() =>
    deriveSortMode(savedListDefaults.overdueFirst, savedListDefaults.mentionFirst)
  );
  const [listMyDirectOnly, setListMyDirectOnly] = useState(savedListDefaults.myDirectOnly);
  const [filterDepartments, setFilterDepartments] = useState<Array<{ id: number; name: string }>>(
    () => cachedFilterOptions.departments
  );
  const [filterLeaders, setFilterLeaders] = useState<
    Array<{ id: number; username: string; realName: string }>
  >(() => cachedFilterOptions.leaders);
  const [filterOptionsFetchedAt, setFilterOptionsFetchedAt] = useState(
    () => cachedFilterOptions.fetchedAt
  );
  const [filterDepartmentKeyword, setFilterDepartmentKeyword] = useState("");
  const [filterLeaderKeyword, setFilterLeaderKeyword] = useState("");
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [rejectTargetIds, setRejectTargetIds] = useState<number[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [reviewNudges, setReviewNudges] = useState<ReviewNudgeItem[]>([]);
  const [nudgeSelectedIds, setNudgeSelectedIds] = useState<number[]>([]);
  const [nudgeStatusFilter, setNudgeStatusFilter] = useState<"all" | "PENDING" | "SENT" | "FAILED">("all");
  const [nudgeLevelFilter, setNudgeLevelFilter] = useState<"all" | "SLA24" | "SLA48">("all");
  const [nudgePage, setNudgePage] = useState(1);
  const [nudgePageSize] = useState(5);
  const [nudgeTotal, setNudgeTotal] = useState(0);
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

  const loadReviewNudges = async (options?: { page?: number; status?: "all" | "PENDING" | "SENT" | "FAILED"; level?: "all" | "SLA24" | "SLA48" }) => {
    try {
      const nextPage = options?.page ?? nudgePage;
      const nextStatus = options?.status ?? nudgeStatusFilter;
      const nextLevel = options?.level ?? nudgeLevelFilter;
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(nudgePageSize));
      if (nextStatus !== "all") {
        params.set("status", nextStatus);
      }
      if (nextLevel !== "all") {
        params.set("level", nextLevel);
      }
      const data = await apiGet<ReviewNudgeListResponse>(`/api/weekly-reports/review-nudges?${params.toString()}`);
      setReviewNudges(data.items ?? []);
      setNudgeTotal(data.total ?? (data.items?.length ?? 0));
      setNudgePage(data.page ?? nextPage);
      setNudgeSelectedIds([]);
    } catch {
      // Ignore nudge list load failures to avoid blocking review flow.
    }
  };

  const updateReviewNudgeStatus = async (
    id: number,
    action: "markSent" | "markFailed" | "retry"
  ) => {
    try {
      const updated = await apiPatch<ReviewNudgeItem>(`/api/weekly-reports/review-nudges/${id}`, {
        action
      });
      setNotice(`催办任务 #${updated.id} 状态已更新为 ${updated.status}`);
      await loadReviewNudges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新催办任务状态失败，请稍后重试。");
    }
  };

  const retrySelectedNudges = async () => {
    if (nudgeSelectedIds.length === 0) {
      setError("请至少选择一条催办任务");
      return;
    }
    try {
      const result = await apiPost<{ count: number }>("/api/weekly-reports/review-nudges/retry-batch", {
        ids: nudgeSelectedIds
      });
      setNotice(`已批量重试 ${result.count} 条催办任务`);
      await loadReviewNudges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "批量重试失败，请稍后重试。");
    }
  };

  const loadFilterOptions = async (options?: { quiet?: boolean; force?: boolean }) => {
    const lastTs = filterOptionsFetchedAt ? new Date(filterOptionsFetchedAt).getTime() : 0;
    const isFresh = lastTs > 0 && Date.now() - lastTs <= FILTER_OPTIONS_CACHE_TTL_MS;
    if (!options?.force && isFresh && (filterDepartments.length > 0 || filterLeaders.length > 0)) {
      return;
    }
    setFilterOptionsLoading(true);
    try {
      const data = await apiGet<ReviewFilterOptionsResponse>(
        "/api/weekly-reports/filter-options?status=PENDING_APPROVAL"
      );
      const nextDepartments = data.departments ?? [];
      const nextLeaders = data.leaders ?? [];
      const fetchedAt = new Date().toISOString();
      setFilterDepartments(nextDepartments);
      setFilterLeaders(nextLeaders);
      setFilterOptionsFetchedAt(fetchedAt);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          FILTER_OPTIONS_CACHE_KEY,
          JSON.stringify({
            departments: nextDepartments,
            leaders: nextLeaders,
            fetchedAt
          } satisfies CachedFilterOptions)
        );
      }
    } catch {
      if (!options?.quiet) {
        setError("加载筛选选项失败，请稍后重试");
      }
    } finally {
      setFilterOptionsLoading(false);
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

  const loadPendingReports = async (
    query?: {
      page?: number;
      pageSize?: number;
      keyword?: string;
      departmentId?: number;
      leaderUserId?: number;
      overdueFirst?: boolean;
      mentionLeaderOnly?: boolean;
      mentionFirst?: boolean;
      myDirectOnly?: boolean;
    }
  ) => {
    const nextPage = query?.page ?? listPage;
    const nextPageSize = query?.pageSize ?? listPageSize;
    const nextKeyword = (query?.keyword ?? listKeyword).trim();
    const nextDepartmentId = query?.departmentId ?? listDepartmentId;
    const nextLeaderUserId = query?.leaderUserId ?? listLeaderUserId;
    const nextOverdueFirst = query?.overdueFirst ?? listOverdueFirst;
    const nextMentionLeaderOnly = query?.mentionLeaderOnly ?? listMentionLeaderOnly;
    const nextMentionFirst = query?.mentionFirst ?? listMentionFirst;
    const nextMyDirectOnly = query?.myDirectOnly ?? listMyDirectOnly;
    const params = new URLSearchParams();
    params.set("status", "PENDING_APPROVAL");
    const useLegacyDefaultQuery =
      nextPage === 1 &&
      nextPageSize === 20 &&
      !nextKeyword &&
      !nextDepartmentId &&
      !nextLeaderUserId &&
      !nextOverdueFirst &&
      !nextMentionLeaderOnly &&
      !nextMentionFirst &&
      !nextMyDirectOnly;
    if (!useLegacyDefaultQuery) {
      params.set("page", String(nextPage));
      params.set("pageSize", String(nextPageSize));
    }
    if (nextKeyword) {
      params.set("keyword", nextKeyword);
    }
    if (nextDepartmentId) {
      params.set("departmentId", String(nextDepartmentId));
    }
    if (nextLeaderUserId) {
      params.set("leaderUserId", String(nextLeaderUserId));
    }
    if (nextOverdueFirst) {
      params.set("overdueFirst", "true");
    }
    if (nextMentionLeaderOnly) {
      params.set("mentionLeaderOnly", "true");
    }
    if (nextMentionFirst) {
      params.set("mentionFirst", "true");
    }
    if (nextMyDirectOnly) {
      params.set("myDirectOnly", "true");
    }

    try {
      const data = await apiGet<ReportListResponse>(`/api/weekly-reports?${params.toString()}`);
      setItems(data.items ?? []);
      setTotalItems(data.total ?? data.items.length);
      setListPage(data.page ?? nextPage);
      setListPageSize(data.pageSize ?? nextPageSize);
      setSelectedIds([]);
      setRejectTargetIds([]);
      return data;
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        setError("你当前没有审批权限，请联系管理员分配角色。");
        return null;
      }
      if (err instanceof ApiClientError && err.status === 401) {
        setError("登录已过期，请重新登录。");
        return null;
      }
      setError("加载审批列表失败，请稍后重试。");
      return null;
    }
  };

  useEffect(() => {
    if (!guard.ready) {
      return;
    }
    const load = async () => {
      try {
        await loadPendingReports({ page: 1, pageSize: listPageSize, keyword: listKeyword });
        await loadAuditLogs();
      } finally {
        setLoading(false);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard.ready]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (filterDepartments.length > 0 || filterLeaders.length > 0 || filterOptionsLoading) {
      return;
    }
    const maybeWindow = window as Window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (!maybeWindow.requestIdleCallback) {
      return;
    }
    const idleId = maybeWindow.requestIdleCallback(() => {
      void loadFilterOptions({ quiet: true });
    });
    return () => {
      maybeWindow.cancelIdleCallback?.(idleId);
    };
  }, [filterDepartments.length, filterLeaders.length, filterOptionsLoading]);

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
      const refreshed = await loadPendingReports({
        page: listPage,
        pageSize: listPageSize,
        keyword: listKeyword,
        departmentId: listDepartmentId,
        leaderUserId: listLeaderUserId,
        overdueFirst: listOverdueFirst,
        mentionFirst: listMentionFirst
      });
      if (refreshed && refreshed.items.length === 0 && listPage > 1) {
        await loadPendingReports({
          page: listPage - 1,
          pageSize: listPageSize,
          keyword: listKeyword,
          departmentId: listDepartmentId,
          leaderUserId: listLeaderUserId,
          overdueFirst: listOverdueFirst,
          mentionFirst: listMentionFirst
        });
      }
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

  const persistListDefaults = (next: ListFilterDefaults) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LIST_FILTER_DEFAULTS_KEY, JSON.stringify(next));
    }
    setSavedListDefaults(next);
  };

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
  const listTotalPages = Math.max(1, Math.ceil(totalItems / listPageSize));
  const listStart = totalItems === 0 ? 0 : (listPage - 1) * listPageSize + 1;
  const listEnd = Math.min(totalItems, listPage * listPageSize);
  const selectedDepartmentLabel = filterDepartments.find((x) => x.id === listDepartmentId)?.name;
  const selectedLeader = filterLeaders.find((x) => x.id === listLeaderUserId);
  const filteredDepartments = filterDepartments.filter((item) =>
    item.name.toLowerCase().includes(filterDepartmentKeyword.trim().toLowerCase())
  );
  const filteredLeaders = filterLeaders.filter((item) =>
    `${item.realName}${item.username}`.toLowerCase().includes(filterLeaderKeyword.trim().toLowerCase())
  );
  const activeFilterTags = [
    listKeyword ? `关键词：${listKeyword}` : "",
    selectedDepartmentLabel ? `部门：${selectedDepartmentLabel}` : "",
    selectedLeader ? `直属领导：${selectedLeader.realName}（${selectedLeader.username}）` : "",
    listOverdueFirst ? "逾期优先" : "",
    listMentionLeaderOnly ? "@领导提醒" : "",
    listMentionFirst ? "提醒优先排序" : "",
    listMyDirectOnly ? "仅我直属团队" : ""
  ].filter(Boolean);
  const filterOptionsUpdatedAtText = filterOptionsFetchedAt
    ? new Date(filterOptionsFetchedAt).toLocaleString("zh-CN")
    : "未加载";
  const formatLogTime = (value: string) =>
    new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  const overdueTodoCount = items.filter((item) => item.isOverdue).length;
  const mentionTodoCount = items.filter((item) => item.mentionLeader).length;
  const normalTodoCount = items.filter((item) => !item.isOverdue && !item.mentionLeader).length;
  const overdueHours = (item: ReviewItem) => {
    if (!item.dueAt) {
      return 0;
    }
    const dueTs = new Date(item.dueAt).getTime();
    if (!Number.isFinite(dueTs)) {
      return 0;
    }
    const diffMs = Date.now() - dueTs;
    if (diffMs <= 0) {
      return 0;
    }
    return diffMs / (1000 * 60 * 60);
  };
  const sla24Items = items.filter((item) => overdueHours(item) >= 24);
  const sla48Items = items.filter((item) => overdueHours(item) >= 48);
  const focusPendingList = () => {
    if (typeof document === "undefined") {
      return;
    }
    const pendingList = document.getElementById("pending-list");
    if (pendingList && typeof pendingList.scrollIntoView === "function") {
      pendingList.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const applyListQuickFilter = (options: {
    overdueFirst: boolean;
    mentionLeaderOnly: boolean;
    mentionFirst: boolean;
    myDirectOnly: boolean;
  }) => {
    setListOverdueFirst(options.overdueFirst);
    setListMentionLeaderOnly(options.mentionLeaderOnly);
    setListMentionFirst(options.mentionFirst);
    setListMyDirectOnly(options.myDirectOnly);
    setListSortMode(deriveSortMode(options.overdueFirst, options.mentionFirst));
    void loadPendingReports({
      page: 1,
      pageSize: listPageSize,
      keyword: listKeywordInput.trim(),
      departmentId: listDepartmentId,
      leaderUserId: listLeaderUserId,
      overdueFirst: options.overdueFirst,
      mentionLeaderOnly: options.mentionLeaderOnly,
      mentionFirst: options.mentionFirst,
      myDirectOnly: options.myDirectOnly
    });
    focusPendingList();
  };
  const focusSlaItems = (targetIds: number[], label: string) => {
    if (targetIds.length === 0) {
      setNotice(`当前没有${label}待办。`);
      focusPendingList();
      return;
    }
    setSelectedIds(targetIds);
    setNotice(`已定位 ${targetIds.length} 条${label}待办，请优先处理。`);
    focusPendingList();
  };
  const triggerSlaNudgePlaceholder = async () => {
    try {
      const result = await apiPost<ReviewNudgeItem>("/api/weekly-reports/review-nudges", {
        level: "SLA24",
        targetReportIds: sla24Items.map((item) => item.id)
      });
      setNotice(
        `催办任务已创建：超24h待办 ${result.targetCount} 条（企业微信/钉钉提醒待接入）。`
      );
      await loadReviewNudges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建催办任务失败，请稍后重试。");
    }
  };

  if (!guard.ready || guard.blocked) {
    return null;
  }

  return (
    <AppShell
      workspace="review-workspace"
      pageTitle="审批管理"
      pageDescription="按优先级处理待办审批，并追踪审批质量。"
    >
      <main className="reviews-page">
      <PageHeader
        title="待我审批"
        subtitle="优先处理超期单，批量操作可显著提升提交率与审批效率"
      />
      <SessionExpiryNotice />
      <ReviewsQuickNav />
      {loading ? <p>加载中...</p> : null}
      {error ? <ResultState type="error" message={error} /> : null}
      {notice ? <ResultState type="success" message={notice} /> : null}
      <ReviewsOverviewStats
        totalItems={totalItems}
        selectedCount={selectedIds.length}
        approvedLogCount={approvedLogCount}
        rejectedLogCount={rejectedLogCount}
        rangeLabel={rangeBounds.label}
        rangeCount={currentRangeCount}
        rangeTrendText={rangeTrendText}
        onRangeChange={setStatsRange}
      />
      <ReviewsFilterPanel
        listKeywordInput={listKeywordInput}
        onKeywordInputChange={setListKeywordInput}
        listPageSize={listPageSize}
        onPageSizeChange={(nextSize) =>
          void loadPendingReports({
            page: 1,
            pageSize: nextSize,
            keyword: listKeywordInput.trim(),
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst
          })
        }
        listDepartmentId={listDepartmentId}
        onDepartmentChange={setListDepartmentId}
        filteredDepartments={filteredDepartments}
        filterDepartmentKeyword={filterDepartmentKeyword}
        onFilterDepartmentKeywordChange={setFilterDepartmentKeyword}
        listLeaderUserId={listLeaderUserId}
        onLeaderUserIdChange={setListLeaderUserId}
        filteredLeaders={filteredLeaders}
        filterLeaderKeyword={filterLeaderKeyword}
        onFilterLeaderKeywordChange={setFilterLeaderKeyword}
        filterOptionsLoading={filterOptionsLoading}
        hasFilterOptions={filterDepartments.length > 0 || filterLeaders.length > 0}
        onRefreshFilterOptions={() => void loadFilterOptions({ force: true })}
        filterOptionsUpdatedAtText={filterOptionsUpdatedAtText}
        listOverdueFirst={listOverdueFirst}
        onOverdueFirstChange={(checked) => {
          setListOverdueFirst(checked);
          setListSortMode(checked ? "overdueFirst" : deriveSortMode(false, listMentionFirst));
        }}
        listMentionLeaderOnly={listMentionLeaderOnly}
        onMentionLeaderOnlyChange={setListMentionLeaderOnly}
        listMentionFirst={listMentionFirst}
        onMentionFirstChange={(checked) => {
          setListMentionFirst(checked);
          setListSortMode(deriveSortMode(listOverdueFirst, checked));
        }}
        listMyDirectOnly={listMyDirectOnly}
        onMyDirectOnlyChange={setListMyDirectOnly}
        listSortMode={listSortMode}
        onSortModeChange={(nextMode) => {
          const nextOverdueFirst = nextMode === "overdueFirst";
          const nextMentionFirst = nextMode === "mentionFirst";
          setListSortMode(nextMode);
          setListOverdueFirst(nextOverdueFirst);
          setListMentionFirst(nextMentionFirst);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeywordInput.trim(),
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: nextOverdueFirst,
            mentionLeaderOnly: listMentionLeaderOnly,
            mentionFirst: nextMentionFirst,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onPresetMyPending={() => {
          setListSortMode("mentionFirst");
          setListOverdueFirst(false);
          setListMentionLeaderOnly(false);
          setListMentionFirst(true);
          setListMyDirectOnly(true);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeywordInput.trim(),
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: false,
            mentionLeaderOnly: false,
            mentionFirst: true,
            myDirectOnly: true
          });
        }}
        onPresetMentionPriority={() => {
          setListSortMode("mentionFirst");
          setListOverdueFirst(false);
          setListMentionLeaderOnly(true);
          setListMentionFirst(true);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeywordInput.trim(),
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: false,
            mentionLeaderOnly: true,
            mentionFirst: true,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onOnlyOverdue={() => {
          setListOverdueFirst(true);
          setListSortMode("overdueFirst");
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeywordInput.trim(),
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: true,
            mentionLeaderOnly: listMentionLeaderOnly,
            mentionFirst: listMentionFirst,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onOnlyMentionLeader={() => {
          setListMentionLeaderOnly(true);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeywordInput.trim(),
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionLeaderOnly: true,
            mentionFirst: listMentionFirst,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onMentionFirstSort={() => {
          setListMentionFirst(true);
          setListSortMode("mentionFirst");
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeywordInput.trim(),
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionLeaderOnly: listMentionLeaderOnly,
            mentionFirst: true,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onOnlyMyDirect={() => {
          setListMyDirectOnly(true);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeywordInput.trim(),
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionLeaderOnly: listMentionLeaderOnly,
            mentionFirst: listMentionFirst,
            myDirectOnly: true
          });
        }}
        onSearch={() => {
          const nextKeyword = listKeywordInput.trim();
          setListKeyword(nextKeyword);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: nextKeyword,
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionLeaderOnly: listMentionLeaderOnly,
            mentionFirst: listMentionFirst,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onSaveDefaults={() => {
          persistListDefaults({
            pageSize: listPageSize,
            keyword: listKeywordInput.trim(),
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionLeaderOnly: listMentionLeaderOnly,
            mentionFirst: listMentionFirst,
            myDirectOnly: listMyDirectOnly
          });
          setNotice("已保存为默认筛选");
        }}
        onRestoreDefaults={() => {
          const next = readListFilterDefaults();
          setListPageSize(next.pageSize);
          setListKeywordInput(next.keyword);
          setListKeyword(next.keyword);
          setListDepartmentId(next.departmentId);
          setListLeaderUserId(next.leaderUserId);
          setListOverdueFirst(next.overdueFirst);
          setListMentionLeaderOnly(next.mentionLeaderOnly);
          setListMentionFirst(next.mentionFirst);
          setListSortMode(deriveSortMode(next.overdueFirst, next.mentionFirst));
          setListMyDirectOnly(next.myDirectOnly);
          void loadPendingReports({
            page: 1,
            pageSize: next.pageSize,
            keyword: next.keyword,
            departmentId: next.departmentId,
            leaderUserId: next.leaderUserId,
            overdueFirst: next.overdueFirst,
            mentionLeaderOnly: next.mentionLeaderOnly,
            mentionFirst: next.mentionFirst,
            myDirectOnly: next.myDirectOnly
          });
        }}
        onReset={() => {
          setListKeywordInput("");
          setListKeyword("");
          setListDepartmentId(undefined);
          setListLeaderUserId(undefined);
          setListOverdueFirst(false);
          setListMentionLeaderOnly(false);
          setListMentionFirst(false);
          setListSortMode("default");
          setListMyDirectOnly(false);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: "",
            departmentId: undefined,
            leaderUserId: undefined,
            overdueFirst: false,
            mentionLeaderOnly: false,
            mentionFirst: false,
            myDirectOnly: false
          });
        }}
        listPage={listPage}
        listTotalPages={listTotalPages}
        listStart={listStart}
        listEnd={listEnd}
        totalItems={totalItems}
        defaultPageSize={savedListDefaults.pageSize}
        activeFilterTagsCount={activeFilterTags.length}
        listKeyword={listKeyword}
        selectedDepartmentLabel={selectedDepartmentLabel}
        selectedLeader={selectedLeader}
        onClearKeywordTag={() => {
          setListKeywordInput("");
          setListKeyword("");
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: "",
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionFirst: listMentionFirst,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onClearDepartmentTag={() => {
          setListDepartmentId(undefined);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeyword,
            departmentId: undefined,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionFirst: listMentionFirst,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onClearLeaderTag={() => {
          setListLeaderUserId(undefined);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeyword,
            departmentId: listDepartmentId,
            leaderUserId: undefined,
            overdueFirst: listOverdueFirst,
            mentionFirst: listMentionFirst,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onClearOverdueTag={() => {
          setListOverdueFirst(false);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeyword,
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: false,
            mentionLeaderOnly: listMentionLeaderOnly,
            mentionFirst: listMentionFirst,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onClearMentionLeaderTag={() => {
          setListMentionLeaderOnly(false);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeyword,
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionLeaderOnly: false,
            mentionFirst: listMentionFirst,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onClearMentionFirstTag={() => {
          setListMentionFirst(false);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeyword,
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionLeaderOnly: listMentionLeaderOnly,
            mentionFirst: false,
            myDirectOnly: listMyDirectOnly
          });
        }}
        onClearMyDirectTag={() => {
          setListMyDirectOnly(false);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: listKeyword,
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionLeaderOnly: listMentionLeaderOnly,
            mentionFirst: listMentionFirst,
            myDirectOnly: false
          });
        }}
        onClearAllTags={() => {
          setListKeywordInput("");
          setListKeyword("");
          setListDepartmentId(undefined);
          setListLeaderUserId(undefined);
          setListOverdueFirst(false);
          setListMentionLeaderOnly(false);
          setListMentionFirst(false);
          setListSortMode("default");
          setListMyDirectOnly(false);
          void loadPendingReports({
            page: 1,
            pageSize: listPageSize,
            keyword: "",
            departmentId: undefined,
            leaderUserId: undefined,
            overdueFirst: false,
            mentionLeaderOnly: false,
            mentionFirst: false,
            myDirectOnly: false
          });
        }}
      />
      {!loading && !error ? (
        <ReviewsEfficiencyPanel
          overdueTodoCount={overdueTodoCount}
          mentionTodoCount={mentionTodoCount}
          normalTodoCount={normalTodoCount}
          sla24Count={sla24Items.length}
          sla48Count={sla48Items.length}
          currentCount={items.length}
          listMyDirectOnly={listMyDirectOnly}
          onQuickFilter={(input) => applyListQuickFilter(input)}
          onFocusSla24={() => focusSlaItems(sla24Items.map((item) => item.id), "超24h")}
          onFocusSla48={() => focusSlaItems(sla48Items.map((item) => item.id), "超48h")}
          onTriggerNudge={() => void triggerSlaNudgePlaceholder()}
          nudgeStatusFilter={nudgeStatusFilter}
          nudgeLevelFilter={nudgeLevelFilter}
          onNudgeStatusFilterChange={(next) => {
            setNudgeStatusFilter(next);
            void loadReviewNudges({ page: 1, status: next, level: nudgeLevelFilter });
          }}
          onNudgeLevelFilterChange={(next) => {
            setNudgeLevelFilter(next);
            void loadReviewNudges({ page: 1, status: nudgeStatusFilter, level: next });
          }}
          onRefreshNudges={() => void loadReviewNudges({ page: 1 })}
          onRetrySelectedNudges={() => void retrySelectedNudges()}
          nudgeSelectedIds={nudgeSelectedIds}
          nudgeTotal={nudgeTotal}
          reviewNudges={reviewNudges}
          renderNudgeItemActions={(id) => (
            <>
              <button type="button" onClick={() => void updateReviewNudgeStatus(id, "markSent")}>
                标记已发送
              </button>
              <button type="button" onClick={() => void updateReviewNudgeStatus(id, "markFailed")}>
                标记失败
              </button>
              <button type="button" onClick={() => void updateReviewNudgeStatus(id, "retry")}>
                重试
              </button>
            </>
          )}
          onToggleNudgeSelection={(id, checked) =>
            setNudgeSelectedIds((prev) =>
              checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
            )
          }
          nudgePage={nudgePage}
          nudgePageSize={nudgePageSize}
          onPrevNudgePage={() => void loadReviewNudges({ page: Math.max(1, nudgePage - 1) })}
          onNextNudgePage={() => void loadReviewNudges({ page: nudgePage + 1 })}
        />
      ) : null}
      <ReviewsPendingPanel
        loading={loading}
        error={error}
        items={items}
        selectedIds={selectedIds}
        onSelectAll={() => setSelectedIds(items.map((item) => item.id))}
        onClearSelection={() => setSelectedIds([])}
        onBatchApprove={() => void reviewMany(selectedIds, "APPROVED")}
        onBatchReject={() => {
          setError("");
          if (selectedIds.length === 0) {
            setError("请至少选择一条周报");
            return;
          }
          setRejectTargetIds(selectedIds);
        }}
        onToggleSelected={toggleSelected}
        onApproveItem={(id) => void reviewMany([id], "APPROVED")}
        onRejectItem={(id) => {
          setError("");
          setRejectTargetIds([id]);
        }}
        listPage={listPage}
        listTotalPages={listTotalPages}
        onPrevPage={() =>
          void loadPendingReports({
            page: Math.max(1, listPage - 1),
            pageSize: listPageSize,
            keyword: listKeyword,
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionFirst: listMentionFirst
          })
        }
        onNextPage={() =>
          void loadPendingReports({
            page: Math.min(listTotalPages, listPage + 1),
            pageSize: listPageSize,
            keyword: listKeyword,
            departmentId: listDepartmentId,
            leaderUserId: listLeaderUserId,
            overdueFirst: listOverdueFirst,
            mentionFirst: listMentionFirst
          })
        }
        rejectTargetIds={rejectTargetIds}
        rejectReason={rejectReason}
        onRejectReasonChange={setRejectReason}
        onConfirmReject={() => void confirmReject()}
        onCancelReject={() => {
          setRejectTargetIds([]);
          setRejectReason("");
        }}
      />
      <ReviewsTemplatesPanel
        isSuperAdmin={isSuperAdmin}
        maskSensitiveInDiffExport={maskSensitiveInDiffExport}
        onMaskSensitiveChange={setMaskSensitiveInDiffExport}
        templateOwnerUserId={templateOwnerUserId}
        onTemplateOwnerUserIdChange={setTemplateOwnerUserId}
        onSwitchTemplateOwner={() => void loadTemplatesFromServer(undefined, { switching: true })}
        templateName={templateName}
        onTemplateNameChange={setTemplateName}
        templateQuery={templateQuery}
        onTemplateQueryChange={setTemplateQuery}
        onSaveCurrentAsTemplate={saveCurrentAsTemplate}
        onExportTemplatesAsJson={exportTemplatesAsJson}
        onImportTemplatesFromJson={importTemplatesFromJson}
        templateJsonText={templateJsonText}
        onTemplateJsonTextChange={(value) => {
          setTemplateJsonText(value);
          if (pendingImportTemplates) {
            setPendingImportTemplates(null);
            setPendingDuplicateCount(0);
          }
        }}
        showPendingImportConflict={Boolean(pendingImportTemplates && pendingDuplicateCount > 0)}
        pendingDuplicateCount={pendingDuplicateCount}
        onImportOverwrite={() => {
          if (pendingImportTemplates) {
            void applyImportedTemplates(pendingImportTemplates, "overwrite");
          }
        }}
        onImportSkip={() => {
          if (pendingImportTemplates) {
            void applyImportedTemplates(pendingImportTemplates, "skip");
          }
        }}
        templateSwitching={templateSwitching}
        templateSwitchedOwner={templateSwitchedOwner}
        filteredTemplates={filteredTemplates}
        templateVersionLoadingId={templateVersionLoadingId}
        templateRenameMap={templateRenameMap}
        templateVersions={templateVersions}
        templateVersionDiffOpenMap={templateVersionDiffOpenMap}
        templateDiffValueExpandMap={templateDiffValueExpandMap}
        onToggleTemplateDiffMaskDefault={(id) => void toggleTemplateDiffMaskDefault(id)}
        onTogglePinTemplate={(id) => void togglePinTemplate(id)}
        onApplyTemplateExport={applyTemplateExport}
        onLoadTemplateVersions={(id) => void loadTemplateVersions(id)}
        onTemplateRenameInputChange={(id, value) =>
          setTemplateRenameMap((prev) => ({ ...prev, [id]: value }))
        }
        onRenameTemplate={(id, fallbackName) => void renameTemplate(id, fallbackName)}
        onRemoveTemplate={(id) => void removeTemplate(id)}
        formatHistoryTime={formatHistoryTime}
        buildTemplateDiffSummary={buildTemplateDiffSummary}
        onCopyTemplateDiffDetails={copyTemplateDiffDetails}
        onExportTemplateDiffDetailsTxt={exportTemplateDiffDetailsTxt}
        onToggleTemplateVersionDiff={(templateId, versionId) =>
          setTemplateVersionDiffOpenMap((prev) => ({
            ...prev,
            [`${templateId}-${versionId}`]: !prev[`${templateId}-${versionId}`]
          }))
        }
        onRollbackTemplate={(templateId, versionId) => void rollbackTemplate(templateId, versionId)}
        buildTemplateDiffDetails={buildTemplateDiffDetails}
        onToggleTemplateDiffValueExpand={(key) =>
          setTemplateDiffValueExpandMap((prev) => ({
            ...prev,
            [key]: !prev[key]
          }))
        }
      />
      <ReviewsLogsPanel
        logDecision={logDecision}
        onLogDecisionChange={setLogDecision}
        logActorKeyword={logActorKeyword}
        onLogActorKeywordChange={setLogActorKeyword}
        logDateFrom={logDateFrom}
        onLogDateFromChange={setLogDateFrom}
        logDateTo={logDateTo}
        onLogDateToChange={setLogDateTo}
        onLoadAuditLogs={() => void loadAuditLogs()}
        onApplyExportPreset={applyExportPreset}
        exportColumns={exportColumns}
        onExportColumnChange={(column, checked) =>
          setExportColumns((prev) => ({ ...prev, [column]: checked }))
        }
        exportEncoding={exportEncoding}
        onExportEncodingChange={setExportEncoding}
        onExportLogsCsv={() => void exportLogsCsv()}
        logs={logs}
        formatLogTime={formatLogTime}
      />
      <ReviewsExportHistoryPanel
        historyQuery={historyQuery}
        onHistoryQueryChange={setHistoryQuery}
        hasSortedHistory={sortedHistory.length > 0}
        historySortBy={historySortBy}
        onHistorySortByChange={setHistorySortBy}
        onToggleHistorySortDir={() =>
          setHistorySortDir((prev) => (prev === "asc" ? "desc" : "asc"))
        }
        onPrevHistoryPage={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
        onNextHistoryPage={() =>
          setHistoryPage((prev) => Math.min(historyPageCount, prev + 1))
        }
        safeHistoryPage={safeHistoryPage}
        historyPageCount={historyPageCount}
        hasAnyExportHistory={exportHistory.length > 0}
        onClearHistory={clearHistory}
        pagedHistory={pagedHistory}
        onReuseHistoryExport={reuseHistoryExport}
        onReDownloadHistory={reDownloadHistory}
        onRemoveHistoryItem={removeHistoryItem}
        formatHistoryTime={formatHistoryTime}
      />
      <ReviewsPerformancePlaceholder />
      </main>
    </AppShell>
  );
}
