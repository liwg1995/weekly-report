"use client";

import { useEffect, useState } from "react";
import { ApiClientError, apiDelete, apiGet, apiPatch, apiPost } from "../../../lib/api-client";
import { getSessionUser } from "../../../lib/auth-session";
import AppShell from "../../../components/app-shell";
import PageHeader from "../../../components/page-header";
import PerformanceCyclesPanel from "../../../components/performance-cycles-panel";
import PerformanceDimensionsPanel from "../../../components/performance-dimensions-panel";
import PerformanceTodosPanel from "../../../components/performance-todos-panel";
import ResultState from "../../../components/result-state";
import { useAuthGuard } from "../../../lib/use-auth-guard";

type PerformanceDimension = {
  id: number;
  version: number;
  key: string;
  name: string;
  weight: number;
  metricHint: string;
};

type PerformanceCycle = {
  id: number;
  name: string;
  version: number;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  dimensions: PerformanceDimension[];
};

type PerformanceTodo = {
  id: number;
  ownerRole: "SUPER_ADMIN" | "DEPT_ADMIN" | "MANAGER";
  title: string;
  done: boolean;
};

export default function ManagerPerformancePage() {
  const guard = useAuthGuard({
    currentPath: "/manager/performance",
    requiredAny: ["performance:read"]
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [todos, setTodos] = useState<PerformanceTodo[]>([]);
  const [cycleName, setCycleName] = useState("");
  const [cycleStartDate, setCycleStartDate] = useState("");
  const [cycleEndDate, setCycleEndDate] = useState("");
  const [cycleStatus, setCycleStatus] = useState<"DRAFT" | "ACTIVE" | "CLOSED">("DRAFT");
  const [editingCycleId, setEditingCycleId] = useState<number | null>(null);
  const [editingCycleName, setEditingCycleName] = useState("");
  const [editingCycleStartDate, setEditingCycleStartDate] = useState("");
  const [editingCycleEndDate, setEditingCycleEndDate] = useState("");
  const [editingCycleVersion, setEditingCycleVersion] = useState(1);
  const [editingCycleStatus, setEditingCycleStatus] = useState<"DRAFT" | "ACTIVE" | "CLOSED">("DRAFT");
  const [dimensionCycleId, setDimensionCycleId] = useState("");
  const [dimensionKey, setDimensionKey] = useState("");
  const [dimensionName, setDimensionName] = useState("");
  const [dimensionWeight, setDimensionWeight] = useState("20");
  const [dimensionMetricHint, setDimensionMetricHint] = useState("");
  const [editingDimensionId, setEditingDimensionId] = useState<number | null>(null);
  const [editingDimensionVersion, setEditingDimensionVersion] = useState(1);
  const [editingDimensionKey, setEditingDimensionKey] = useState("");
  const [editingDimensionName, setEditingDimensionName] = useState("");
  const [editingDimensionWeight, setEditingDimensionWeight] = useState("20");
  const [editingDimensionMetricHint, setEditingDimensionMetricHint] = useState("");
  const sessionUser = getSessionUser();
  const requiredTextError = "请先补全必填项后再提交。";

  const loadOverview = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ cycles: PerformanceCycle[]; todos: PerformanceTodo[] }>(
        "/api/performance/overview"
      );
      const nextCycles = data.cycles || [];
      setCycles(nextCycles);
      setTodos(data.todos || []);
      if (!dimensionCycleId && nextCycles.length > 0) {
        setDimensionCycleId(String(nextCycles[0].id));
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        setError("你当前没有查看绩效占位信息的权限。");
      } else {
        setError("加载绩效占位数据失败，请稍后重试。");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!guard.ready) {
      return;
    }

    const bootstrap = async () => {
      await loadOverview();
    };

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard.ready]);

  const canCreateCycle = Boolean(cycleName.trim()) && Boolean(cycleStartDate) && Boolean(cycleEndDate);
  const canCreateDimension = Boolean(dimensionCycleId) && Boolean(dimensionKey.trim()) && Boolean(dimensionName.trim()) && Boolean(dimensionMetricHint.trim());
  const canSaveCycle = Boolean(editingCycleName.trim()) && Boolean(editingCycleStartDate) && Boolean(editingCycleEndDate);
  const canSaveDimension = Boolean(editingDimensionKey.trim()) && Boolean(editingDimensionName.trim()) && Boolean(editingDimensionMetricHint.trim());

  const createCycle = async () => {
    setError("");
    setNotice("");
    if (!canCreateCycle) {
      setError(requiredTextError);
      return;
    }
    try {
      await apiPost(
        "/api/performance/cycles",
        {
          name: cycleName.trim(),
          startDate: cycleStartDate,
          endDate: cycleEndDate,
          status: cycleStatus
        }
      );
      setNotice("绩效周期已创建");
      setCycleName("");
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建周期失败");
    }
  };

  const createDimension = async () => {
    setError("");
    setNotice("");
    const cycleId = Number(dimensionCycleId);
    if (!canCreateDimension || !cycleId) {
      setError(requiredTextError);
      return;
    }
    try {
      await apiPost(
        `/api/performance/cycles/${cycleId}/dimensions`,
        {
          key: dimensionKey.trim(),
          name: dimensionName.trim(),
          weight: Number(dimensionWeight),
          metricHint: dimensionMetricHint.trim()
        }
      );
      setNotice("绩效维度已新增");
      setDimensionKey("");
      setDimensionName("");
      setDimensionMetricHint("");
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增维度失败");
    }
  };

  const beginEditCycle = (cycle: PerformanceCycle) => {
    setEditingCycleId(cycle.id);
    setEditingCycleName(cycle.name);
    setEditingCycleStartDate(cycle.startDate.slice(0, 10));
    setEditingCycleEndDate(cycle.endDate.slice(0, 10));
    setEditingCycleStatus(cycle.status);
    setEditingCycleVersion(cycle.version);
  };

  const cancelEditCycle = () => {
    setEditingCycleId(null);
  };

  const saveEditCycle = async (cycleId: number) => {
    setError("");
    setNotice("");
    if (!canSaveCycle) {
      setError(requiredTextError);
      return;
    }
    try {
      await apiPatch(`/api/performance/cycles/${cycleId}`, {
        name: editingCycleName.trim(),
        startDate: editingCycleStartDate,
        endDate: editingCycleEndDate,
        status: editingCycleStatus,
        version: editingCycleVersion
      });
      setNotice("绩效周期已更新");
      setEditingCycleId(null);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新周期失败");
    }
  };

  const removeCycle = async (cycleId: number) => {
    if (!window.confirm(`确认删除该绩效周期？该操作将联动删除该周期的全部维度，且不可恢复。`)) {
      return;
    }
    if (!window.confirm("请再次确认：继续删除该绩效周期及其全部维度？")) {
      return;
    }
    setError("");
    setNotice("");
    try {
      await apiDelete(`/api/performance/cycles/${cycleId}`);
      if (editingCycleId === cycleId) {
        setEditingCycleId(null);
      }
      if (dimensionCycleId === String(cycleId)) {
        setDimensionCycleId("");
      }
      setNotice("绩效周期已删除");
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除周期失败");
    }
  };

  const beginEditDimension = (dimension: PerformanceDimension) => {
    setEditingDimensionId(dimension.id);
    setEditingDimensionVersion(dimension.version);
    setEditingDimensionKey(dimension.key);
    setEditingDimensionName(dimension.name);
    setEditingDimensionWeight(String(dimension.weight));
    setEditingDimensionMetricHint(dimension.metricHint);
  };

  const cancelEditDimension = () => {
    setEditingDimensionId(null);
  };

  const saveEditDimension = async (dimensionId: number) => {
    setError("");
    setNotice("");
    if (!canSaveDimension) {
      setError(requiredTextError);
      return;
    }
    try {
      await apiPatch(`/api/performance/dimensions/${dimensionId}`, {
        key: editingDimensionKey.trim(),
        name: editingDimensionName.trim(),
        weight: Number(editingDimensionWeight),
        metricHint: editingDimensionMetricHint.trim(),
        version: editingDimensionVersion
      });
      setNotice("绩效维度已更新");
      setEditingDimensionId(null);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新维度失败");
    }
  };

  const removeDimension = async (dimensionId: number) => {
    if (!window.confirm("确认删除该绩效维度？")) {
      return;
    }
    setError("");
    setNotice("");
    try {
      await apiDelete(`/api/performance/dimensions/${dimensionId}`);
      if (editingDimensionId === dimensionId) {
        setEditingDimensionId(null);
      }
      setNotice("绩效维度已删除");
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除维度失败");
    }
  };

  const updateTodoDone = async (todoId: number, done: boolean) => {
    setError("");
    setNotice("");
    try {
      await apiPatch(`/api/performance/todos/${todoId}`, { done });
      setTodos((prev) => prev.map((item) => (item.id === todoId ? { ...item, done } : item)));
      setNotice("待办状态已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新待办失败");
    }
  };

  if (!guard.ready || guard.blocked) {
    return null;
  }

  return (
    <AppShell
      workspace="admin-workspace"
      pageTitle="绩效配置"
      pageDescription="支持编辑/删除绩效周期与维度"
    >
      <div style={{ padding: "4px 0", maxWidth: "960px", margin: "0 auto" }}>
        <PageHeader
          title="绩效考核（占位）"
          subtitle="当前仅实现字段结构与流程占位，后续将与审批建议、周报目标完成度联动。"
        />

        {loading ? <p>加载中...</p> : null}
        {error ? <ResultState type="error" message={error} /> : null}
        {notice ? <ResultState type="success" message={notice} /> : null}

      <PerformanceCyclesPanel
        cycleName={cycleName}
        onCycleNameChange={setCycleName}
        cycleStartDate={cycleStartDate}
        onCycleStartDateChange={setCycleStartDate}
        cycleEndDate={cycleEndDate}
        onCycleEndDateChange={setCycleEndDate}
        cycleStatus={cycleStatus}
        onCycleStatusChange={setCycleStatus}
        canCreateCycle={canCreateCycle}
        onCreateCycle={() => void createCycle()}
        cycles={cycles}
        editingCycleId={editingCycleId}
        editingCycleName={editingCycleName}
        onEditingCycleNameChange={setEditingCycleName}
        editingCycleStartDate={editingCycleStartDate}
        onEditingCycleStartDateChange={setEditingCycleStartDate}
        editingCycleEndDate={editingCycleEndDate}
        onEditingCycleEndDateChange={setEditingCycleEndDate}
        editingCycleStatus={editingCycleStatus}
        onEditingCycleStatusChange={setEditingCycleStatus}
        canSaveCycle={canSaveCycle}
        onBeginEditCycle={(cycleId) => {
          const cycle = cycles.find((item) => item.id === cycleId);
          if (cycle) {
            beginEditCycle(cycle);
          }
        }}
        onSaveCycle={(cycleId) => void saveEditCycle(cycleId)}
        onCancelEditCycle={cancelEditCycle}
        onRemoveCycle={(cycleId) => void removeCycle(cycleId)}
      />

      <PerformanceDimensionsPanel
        dimensionCycleId={dimensionCycleId}
        onDimensionCycleIdChange={setDimensionCycleId}
        dimensionKey={dimensionKey}
        onDimensionKeyChange={setDimensionKey}
        dimensionName={dimensionName}
        onDimensionNameChange={setDimensionName}
        dimensionWeight={dimensionWeight}
        onDimensionWeightChange={setDimensionWeight}
        dimensionMetricHint={dimensionMetricHint}
        onDimensionMetricHintChange={setDimensionMetricHint}
        canCreateDimension={canCreateDimension}
        onCreateDimension={() => void createDimension()}
        cycles={cycles}
        editingDimensionId={editingDimensionId}
        editingDimensionKey={editingDimensionKey}
        onEditingDimensionKeyChange={setEditingDimensionKey}
        editingDimensionName={editingDimensionName}
        onEditingDimensionNameChange={setEditingDimensionName}
        editingDimensionWeight={editingDimensionWeight}
        onEditingDimensionWeightChange={setEditingDimensionWeight}
        editingDimensionMetricHint={editingDimensionMetricHint}
        onEditingDimensionMetricHintChange={setEditingDimensionMetricHint}
        canSaveDimension={canSaveDimension}
        onBeginEditDimension={(dimensionId) => {
          const dimension = cycles
            .flatMap((cycle) => cycle.dimensions)
            .find((item) => item.id === dimensionId);
          if (dimension) {
            beginEditDimension(dimension);
          }
        }}
        onSaveDimension={(dimensionId) => void saveEditDimension(dimensionId)}
        onCancelEditDimension={cancelEditDimension}
        onRemoveDimension={(dimensionId) => void removeDimension(dimensionId)}
      />

      <PerformanceTodosPanel
        todos={todos}
        onUpdateTodoDone={(todoId, done) => void updateTodoDone(todoId, done)}
      />

      <footer style={{ marginTop: "14px", color: "var(--muted)", fontSize: "13px" }}>
        当前用户：{sessionUser?.username ?? "未知"} | 返回审批台：<a href="/manager/reviews">/manager/reviews</a>
      </footer>
      </div>
    </AppShell>
  );
}
