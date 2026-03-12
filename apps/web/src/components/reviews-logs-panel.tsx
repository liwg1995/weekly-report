type AuditItem = {
  id: number;
  action: string;
  targetId: string;
  createdAt: string;
  actor: { id: number; username: string; realName: string } | null;
};

type ExportColumn = "time" | "actor" | "action" | "targetId";

type Props = {
  logDecision: "all" | "APPROVED" | "REJECTED";
  onLogDecisionChange: (value: "all" | "APPROVED" | "REJECTED") => void;
  logActorKeyword: string;
  onLogActorKeywordChange: (value: string) => void;
  logDateFrom: string;
  onLogDateFromChange: (value: string) => void;
  logDateTo: string;
  onLogDateToChange: (value: string) => void;
  onLoadAuditLogs: () => void;
  onApplyExportPreset: (preset: "retro" | "audit") => void;
  exportColumns: Record<ExportColumn, boolean>;
  onExportColumnChange: (column: ExportColumn, checked: boolean) => void;
  exportEncoding: "utf-8" | "gbk";
  onExportEncodingChange: (value: "utf-8" | "gbk") => void;
  onExportLogsCsv: () => void;
  logs: AuditItem[];
  formatLogTime: (value: string) => string;
};

export default function ReviewsLogsPanel(props: Props) {
  return (
    <section id="logs" style={{ marginTop: "16px", padding: "12px" }}>
      <h2 style={{ marginTop: 0, fontSize: "16px" }}>操作日志</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
        <label>
          结果：
          <select
            aria-label="日志结果筛选"
            value={props.logDecision}
            onChange={(event) =>
              props.onLogDecisionChange(event.target.value as "all" | "APPROVED" | "REJECTED")
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
            value={props.logActorKeyword}
            onChange={(event) => props.onLogActorKeywordChange(event.target.value)}
            placeholder="姓名或账号"
            style={{ marginLeft: "6px" }}
          />
        </label>
        <label>
          开始：
          <input
            aria-label="日志开始日期筛选"
            type="date"
            value={props.logDateFrom}
            onChange={(event) => props.onLogDateFromChange(event.target.value)}
            style={{ marginLeft: "6px" }}
          />
        </label>
        <label>
          结束：
          <input
            aria-label="日志结束日期筛选"
            type="date"
            value={props.logDateTo}
            onChange={(event) => props.onLogDateToChange(event.target.value)}
            style={{ marginLeft: "6px" }}
          />
        </label>
        <button type="button" onClick={props.onLoadAuditLogs}>
          筛选日志
        </button>
        <button type="button" onClick={() => props.onApplyExportPreset("retro")}>
          复盘版预设
        </button>
        <button type="button" onClick={() => props.onApplyExportPreset("audit")}>
          审计版预设
        </button>
        <span style={{ color: "var(--muted)" }}>导出字段：</span>
        <label>
          <input
            aria-label="导出字段-时间"
            type="checkbox"
            checked={props.exportColumns.time}
            onChange={(event) => props.onExportColumnChange("time", event.target.checked)}
          />
          时间
        </label>
        <label>
          <input
            aria-label="导出字段-审批人"
            type="checkbox"
            checked={props.exportColumns.actor}
            onChange={(event) => props.onExportColumnChange("actor", event.target.checked)}
          />
          审批人
        </label>
        <label>
          <input
            aria-label="导出字段-动作"
            type="checkbox"
            checked={props.exportColumns.action}
            onChange={(event) => props.onExportColumnChange("action", event.target.checked)}
          />
          动作
        </label>
        <label>
          <input
            aria-label="导出字段-周报ID"
            type="checkbox"
            checked={props.exportColumns.targetId}
            onChange={(event) => props.onExportColumnChange("targetId", event.target.checked)}
          />
          周报ID
        </label>
        <label>
          编码：
          <select
            aria-label="导出编码"
            value={props.exportEncoding}
            onChange={(event) => props.onExportEncodingChange(event.target.value as "utf-8" | "gbk")}
            style={{ marginLeft: "6px" }}
          >
            <option value="utf-8">UTF-8</option>
            <option value="gbk">GBK</option>
          </select>
        </label>
        <button type="button" onClick={props.onExportLogsCsv}>
          导出CSV
        </button>
      </div>
      {props.logs.length === 0 ? <p style={{ margin: 0 }}>暂无操作日志</p> : null}
      {props.logs.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: "18px" }}>
          {props.logs.map((item) => {
            const actionText = item.action === "REVIEW_APPROVED" ? "通过" : "驳回";
            const actorName = item.actor?.realName || item.actor?.username || "未知审批人";
            return (
              <li key={item.id}>
                {actorName} {actionText}周报 #{item.targetId}（{props.formatLogTime(item.createdAt)}）
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
