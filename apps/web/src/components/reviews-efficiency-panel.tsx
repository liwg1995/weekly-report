import type { ReactNode } from "react";

type NudgeItem = {
  id: number;
  level: string;
  status: string;
  channel: string;
  targetCount: number;
  message: string;
  createdAt: string;
  updatedAt?: string;
};

type Props = {
  overdueTodoCount: number;
  mentionTodoCount: number;
  normalTodoCount: number;
  sla24Count: number;
  sla48Count: number;
  currentCount: number;
  listMyDirectOnly: boolean;
  onQuickFilter: (input: {
    overdueFirst: boolean;
    mentionLeaderOnly: boolean;
    mentionFirst: boolean;
    myDirectOnly: boolean;
  }) => void;
  onFocusSla24: () => void;
  onFocusSla48: () => void;
  onTriggerNudge: () => void;
  nudgeStatusFilter: "all" | "PENDING" | "SENT" | "FAILED";
  nudgeLevelFilter: "all" | "SLA24" | "SLA48";
  onNudgeStatusFilterChange: (next: "all" | "PENDING" | "SENT" | "FAILED") => void;
  onNudgeLevelFilterChange: (next: "all" | "SLA24" | "SLA48") => void;
  onRefreshNudges: () => void;
  onRetrySelectedNudges: () => void;
  nudgeSelectedIds: number[];
  nudgeTotal: number;
  reviewNudges: NudgeItem[];
  renderNudgeItemActions: (id: number) => ReactNode;
  onToggleNudgeSelection: (id: number, checked: boolean) => void;
  nudgePage: number;
  nudgePageSize: number;
  onPrevNudgePage: () => void;
  onNextNudgePage: () => void;
};

export default function ReviewsEfficiencyPanel(props: Props) {
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "12px",
        marginBottom: "12px"
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: "16px" }}>审批效率面板</h2>
      <p style={{ marginTop: 0, color: "var(--muted)", fontSize: "12px" }}>
        今日待办分组（按当前筛选结果）
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <span>逾期待办：{props.overdueTodoCount}</span>
        <span>@提醒待办：{props.mentionTodoCount}</span>
        <span>普通待办：{props.normalTodoCount}</span>
        <span>超24h未处理：{props.sla24Count}</span>
        <span>超48h未处理：{props.sla48Count}</span>
        <span>当前页总数：{props.currentCount}</span>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() =>
            props.onQuickFilter({
              overdueFirst: true,
              mentionLeaderOnly: false,
              mentionFirst: false,
              myDirectOnly: props.listMyDirectOnly
            })
          }
        >
          一键处理逾期
        </button>
        <button
          type="button"
          onClick={() =>
            props.onQuickFilter({
              overdueFirst: false,
              mentionLeaderOnly: true,
              mentionFirst: true,
              myDirectOnly: props.listMyDirectOnly
            })
          }
        >
          一键处理@提醒
        </button>
        <button
          type="button"
          onClick={() =>
            props.onQuickFilter({
              overdueFirst: false,
              mentionLeaderOnly: false,
              mentionFirst: false,
              myDirectOnly: props.listMyDirectOnly
            })
          }
        >
          一键处理普通
        </button>
        <button type="button" onClick={props.onFocusSla24}>
          一键定位超24h
        </button>
        <button type="button" onClick={props.onFocusSla48}>
          一键定位超48h
        </button>
        <button type="button" onClick={props.onTriggerNudge}>
          一键催办（占位）
        </button>
      </div>

      <div style={{ marginTop: "8px" }}>
        <div style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "6px" }}>催办队列</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
          <select
            aria-label="催办状态筛选"
            value={props.nudgeStatusFilter}
            onChange={(event) =>
              props.onNudgeStatusFilterChange(
                event.target.value as "all" | "PENDING" | "SENT" | "FAILED"
              )
            }
          >
            <option value="all">全部状态</option>
            <option value="PENDING">待发送</option>
            <option value="SENT">已发送</option>
            <option value="FAILED">失败</option>
          </select>
          <select
            aria-label="催办级别筛选"
            value={props.nudgeLevelFilter}
            onChange={(event) =>
              props.onNudgeLevelFilterChange(
                event.target.value as "all" | "SLA24" | "SLA48"
              )
            }
          >
            <option value="all">全部级别</option>
            <option value="SLA24">SLA24</option>
            <option value="SLA48">SLA48</option>
          </select>
          <button type="button" onClick={props.onRefreshNudges}>
            刷新催办队列
          </button>
          <button type="button" onClick={props.onRetrySelectedNudges}>
            批量重试
          </button>
          <span style={{ color: "var(--muted)", fontSize: "12px", alignSelf: "center" }}>
            已选 {props.nudgeSelectedIds.length} / 共 {props.nudgeTotal}
          </span>
        </div>

        {props.reviewNudges.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: "12px" }}>暂无催办任务</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "6px" }}>
            {props.reviewNudges.map((item) => (
              <li
                key={item.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "8px",
                  display: "grid",
                  gap: "6px"
                }}
              >
                <div style={{ fontSize: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    aria-label={`选择催办任务-${item.id}`}
                    checked={props.nudgeSelectedIds.includes(item.id)}
                    onChange={(event) => props.onToggleNudgeSelection(item.id, event.target.checked)}
                  />
                  <span>
                    #{item.id} {item.level} / {item.targetCount}条 / {item.status}
                  </span>
                </div>
                <div style={{ color: "var(--muted)", fontSize: "12px" }}>{item.message}</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {props.renderNudgeItemActions(item.id)}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "8px", fontSize: "12px" }}>
          <button type="button" disabled={props.nudgePage <= 1} onClick={props.onPrevNudgePage}>
            上一页
          </button>
          <button
            type="button"
            disabled={props.nudgePage * props.nudgePageSize >= props.nudgeTotal}
            onClick={props.onNextNudgePage}
          >
            下一页
          </button>
          <span style={{ color: "var(--muted)" }}>
            第 {props.nudgePage} 页 / 每页 {props.nudgePageSize} 条 / 总计 {props.nudgeTotal}
          </span>
        </div>
      </div>
    </section>
  );
}
