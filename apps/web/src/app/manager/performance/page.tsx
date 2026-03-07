"use client";

import { useEffect, useState } from "react";
import { ApiClientError, apiDelete, apiGet, apiPatch, apiPost } from "../../../lib/api-client";
import { getSessionUser, logoutWithConfirm, requireRole } from "../../../lib/auth-session";

type PerformanceDimension = {
  id: number;
  key: string;
  name: string;
  weight: number;
  metricHint: string;
};

type PerformanceCycle = {
  id: number;
  name: string;
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
  const [ready, setReady] = useState(false);
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
  const [editingCycleStatus, setEditingCycleStatus] = useState<"DRAFT" | "ACTIVE" | "CLOSED">("DRAFT");
  const [dimensionCycleId, setDimensionCycleId] = useState("");
  const [dimensionKey, setDimensionKey] = useState("");
  const [dimensionName, setDimensionName] = useState("");
  const [dimensionWeight, setDimensionWeight] = useState("20");
  const [dimensionMetricHint, setDimensionMetricHint] = useState("");
  const [editingDimensionId, setEditingDimensionId] = useState<number | null>(null);
  const [editingDimensionKey, setEditingDimensionKey] = useState("");
  const [editingDimensionName, setEditingDimensionName] = useState("");
  const [editingDimensionWeight, setEditingDimensionWeight] = useState("20");
  const [editingDimensionMetricHint, setEditingDimensionMetricHint] = useState("");
  const sessionUser = getSessionUser();

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
    const allowed = requireRole(["SUPER_ADMIN", "DEPT_ADMIN", "MANAGER"], "/employee/feedback");
    if (!allowed) {
      return;
    }

    let cancelled = false;
    setReady(true);

    const bootstrap = async () => {
      if (cancelled) {
        return;
      }
      await loadOverview();
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCycle = async () => {
    setError("");
    setNotice("");
    if (!cycleName.trim() || !cycleStartDate || !cycleEndDate) {
      setError("请完整填写周期信息");
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
    if (!cycleId || !dimensionKey.trim() || !dimensionName.trim() || !dimensionMetricHint.trim()) {
      setError("请完整填写维度信息");
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
  };

  const cancelEditCycle = () => {
    setEditingCycleId(null);
  };

  const saveEditCycle = async (cycleId: number) => {
    setError("");
    setNotice("");
    if (!editingCycleName.trim() || !editingCycleStartDate || !editingCycleEndDate) {
      setError("周期名称与日期不能为空");
      return;
    }
    try {
      await apiPatch(`/api/performance/cycles/${cycleId}`, {
        name: editingCycleName.trim(),
        startDate: editingCycleStartDate,
        endDate: editingCycleEndDate,
        status: editingCycleStatus
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
    if (!editingDimensionKey.trim() || !editingDimensionName.trim() || !editingDimensionMetricHint.trim()) {
      setError("维度字段不能为空");
      return;
    }
    try {
      await apiPatch(`/api/performance/dimensions/${dimensionId}`, {
        key: editingDimensionKey.trim(),
        name: editingDimensionName.trim(),
        weight: Number(editingDimensionWeight),
        metricHint: editingDimensionMetricHint.trim()
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

  if (!ready) {
    return <main style={{ padding: "24px" }}>加载中...</main>;
  }

  return (
    <main style={{ padding: "24px", maxWidth: "960px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>绩效考核（占位）</h1>
          <p style={{ color: "var(--muted)", marginTop: "8px" }}>
            当前仅实现字段结构与流程占位，后续将与审批建议、周报目标完成度联动。
          </p>
        </div>
        <button type="button" onClick={logoutWithConfirm}>退出登录</button>
      </header>

      {loading ? <p>加载中...</p> : null}
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--primary-strong)" }}>{notice}</p> : null}

      <section style={{ marginTop: "14px", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", background: "var(--surface)" }}>
        <h2 style={{ marginTop: 0, fontSize: "16px" }}>配置绩效周期</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <label>
            周期名称
            <input aria-label="绩效周期名称" value={cycleName} onChange={(event) => setCycleName(event.target.value)} />
          </label>
          <label>
            开始日期
            <input aria-label="周期开始日期" type="date" value={cycleStartDate} onChange={(event) => setCycleStartDate(event.target.value)} />
          </label>
          <label>
            结束日期
            <input aria-label="周期结束日期" type="date" value={cycleEndDate} onChange={(event) => setCycleEndDate(event.target.value)} />
          </label>
          <label>
            状态
            <select value={cycleStatus} onChange={(event) => setCycleStatus(event.target.value as "DRAFT" | "ACTIVE" | "CLOSED")}>
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
          <button type="button" onClick={() => void createCycle()}>创建绩效周期</button>
        </div>
      </section>

      <section style={{ marginTop: "14px", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", background: "var(--surface)" }}>
        <h2 style={{ marginTop: 0, fontSize: "16px" }}>新增绩效维度</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <label>
            所属周期
            <select
              aria-label="维度所属周期"
              value={dimensionCycleId}
              onChange={(event) => setDimensionCycleId(event.target.value)}
            >
              <option value="">请选择</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            维度Key
            <input aria-label="维度Key" value={dimensionKey} onChange={(event) => setDimensionKey(event.target.value)} />
          </label>
          <label>
            维度名称
            <input aria-label="维度名称" value={dimensionName} onChange={(event) => setDimensionName(event.target.value)} />
          </label>
          <label>
            权重
            <input aria-label="维度权重" type="number" min={1} max={100} value={dimensionWeight} onChange={(event) => setDimensionWeight(event.target.value)} />
          </label>
          <label>
            指标说明
            <input aria-label="维度指标说明" value={dimensionMetricHint} onChange={(event) => setDimensionMetricHint(event.target.value)} />
          </label>
          <button type="button" onClick={() => void createDimension()}>新增绩效维度</button>
        </div>
      </section>

      <section style={{ marginTop: "14px", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", background: "var(--surface)" }}>
        <h2 style={{ marginTop: 0, fontSize: "16px" }}>当前草案周期</h2>
        {cycles.length === 0 ? <p style={{ marginBottom: 0 }}>暂无草案周期</p> : null}
        {cycles.map((cycle) => (
          <article key={cycle.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", marginBottom: "10px" }}>
            <div>
              <strong>{cycle.name}</strong>
              <span style={{ marginLeft: "8px", color: "var(--muted)" }}>
                {cycle.startDate.slice(0, 10)} ~ {cycle.endDate.slice(0, 10)} / {cycle.status}
              </span>
            </div>
            {editingCycleId === cycle.id ? (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                <label>
                  周期名称
                  <input
                    aria-label={`编辑周期名称-${cycle.id}`}
                    value={editingCycleName}
                    onChange={(event) => setEditingCycleName(event.target.value)}
                  />
                </label>
                <label>
                  开始日期
                  <input
                    aria-label={`编辑周期开始日期-${cycle.id}`}
                    type="date"
                    value={editingCycleStartDate}
                    onChange={(event) => setEditingCycleStartDate(event.target.value)}
                  />
                </label>
                <label>
                  结束日期
                  <input
                    aria-label={`编辑周期结束日期-${cycle.id}`}
                    type="date"
                    value={editingCycleEndDate}
                    onChange={(event) => setEditingCycleEndDate(event.target.value)}
                  />
                </label>
                <label>
                  状态
                  <select
                    value={editingCycleStatus}
                    onChange={(event) => setEditingCycleStatus(event.target.value as "DRAFT" | "ACTIVE" | "CLOSED")}
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </label>
                <button type="button" onClick={() => void saveEditCycle(cycle.id)} aria-label={`保存周期-${cycle.id}`}>
                  保存
                </button>
                <button type="button" onClick={cancelEditCycle} aria-label={`取消编辑周期-${cycle.id}`}>
                  取消
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button type="button" onClick={() => beginEditCycle(cycle)} aria-label={`编辑周期-${cycle.id}`}>
                  编辑
                </button>
                <button type="button" onClick={() => void removeCycle(cycle.id)} aria-label={`删除周期-${cycle.id}`}>
                  删除
                </button>
              </div>
            )}
            <ul style={{ marginBottom: 0 }}>
              {cycle.dimensions.map((dimension) => (
                <li key={dimension.id}>
                  {editingDimensionId === dimension.id ? (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                      <label>
                        维度Key
                        <input
                          aria-label={`编辑维度Key-${dimension.id}`}
                          value={editingDimensionKey}
                          onChange={(event) => setEditingDimensionKey(event.target.value)}
                        />
                      </label>
                      <label>
                        维度名称
                        <input
                          aria-label={`编辑维度名称-${dimension.id}`}
                          value={editingDimensionName}
                          onChange={(event) => setEditingDimensionName(event.target.value)}
                        />
                      </label>
                      <label>
                        权重
                        <input
                          aria-label={`编辑维度权重-${dimension.id}`}
                          type="number"
                          min={1}
                          max={100}
                          value={editingDimensionWeight}
                          onChange={(event) => setEditingDimensionWeight(event.target.value)}
                        />
                      </label>
                      <label>
                        指标说明
                        <input
                          aria-label={`编辑维度指标说明-${dimension.id}`}
                          value={editingDimensionMetricHint}
                          onChange={(event) => setEditingDimensionMetricHint(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void saveEditDimension(dimension.id)}
                        aria-label={`保存维度-${dimension.id}`}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditDimension}
                        aria-label={`取消编辑维度-${dimension.id}`}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      {dimension.name}（{dimension.weight}%）：{dimension.metricHint}
                      <div style={{ display: "inline-flex", gap: "8px", marginLeft: "8px" }}>
                        <button
                          type="button"
                          onClick={() => beginEditDimension(dimension)}
                          aria-label={`编辑维度-${dimension.id}`}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeDimension(dimension.id)}
                          aria-label={`删除维度-${dimension.id}`}
                        >
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section style={{ marginTop: "14px", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", background: "var(--surface)" }}>
        <h2 style={{ marginTop: 0, fontSize: "16px" }}>待办清单（占位）</h2>
        {todos.length === 0 ? <p style={{ marginBottom: 0 }}>暂无待办</p> : null}
        <ul style={{ margin: 0 }}>
          {todos.map((todo) => (
            <li key={todo.id}>
              <label>
                <input
                  aria-label={`待办完成-${todo.id}`}
                  type="checkbox"
                  checked={todo.done}
                  onChange={(event) => void updateTodoDone(todo.id, event.target.checked)}
                />
                [{todo.ownerRole}] {todo.title} {todo.done ? "(已完成)" : "(待确认)"}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <footer style={{ marginTop: "14px", color: "var(--muted)", fontSize: "13px" }}>
        当前用户：{sessionUser?.username ?? "未知"} | 返回审批台：<a href="/manager/reviews">/manager/reviews</a>
      </footer>
    </main>
  );
}
