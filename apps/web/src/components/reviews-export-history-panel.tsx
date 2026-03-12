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
  columns?: Record<"time" | "actor" | "action" | "targetId", boolean>;
  encoding?: "utf-8" | "gbk";
};

type Props = {
  historyQuery: string;
  onHistoryQueryChange: (value: string) => void;
  hasSortedHistory: boolean;
  historySortBy: "createdAt" | "fileName";
  onHistorySortByChange: (value: "createdAt" | "fileName") => void;
  onToggleHistorySortDir: () => void;
  onPrevHistoryPage: () => void;
  onNextHistoryPage: () => void;
  safeHistoryPage: number;
  historyPageCount: number;
  hasAnyExportHistory: boolean;
  onClearHistory: () => void;
  pagedHistory: ExportHistoryItem[];
  onReuseHistoryExport: (item: ExportHistoryItem) => void;
  onReDownloadHistory: (item: ExportHistoryItem) => void;
  onRemoveHistoryItem: (id: string) => void;
  formatHistoryTime: (value: string) => string;
};

export default function ReviewsExportHistoryPanel(props: Props) {
  return (
    <section id="exports" style={{ marginTop: "16px", padding: "12px" }}>
      <h2 style={{ marginTop: 0, fontSize: "16px" }}>导出任务中心</h2>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <input
          aria-label="导出记录搜索"
          placeholder="按文件名搜索"
          value={props.historyQuery}
          onChange={(event) => props.onHistoryQueryChange(event.target.value)}
        />
        {props.hasSortedHistory ? (
          <>
            <label>
              排序：
              <select
                aria-label="导出记录排序字段"
                value={props.historySortBy}
                onChange={(event) =>
                  props.onHistorySortByChange(event.target.value as "createdAt" | "fileName")
                }
                style={{ marginLeft: "6px" }}
              >
                <option value="createdAt">时间</option>
                <option value="fileName">文件名</option>
              </select>
            </label>
            <button type="button" onClick={props.onToggleHistorySortDir}>
              切换排序方向
            </button>
            <button type="button" onClick={props.onPrevHistoryPage} disabled={props.safeHistoryPage <= 1}>
              上一页
            </button>
            <button
              type="button"
              onClick={props.onNextHistoryPage}
              disabled={props.safeHistoryPage >= props.historyPageCount}
            >
              下一页
            </button>
            <span style={{ color: "var(--muted)" }}>
              第 {props.safeHistoryPage} / {props.historyPageCount} 页
            </span>
          </>
        ) : null}
      </div>
      {props.hasAnyExportHistory ? (
        <div style={{ marginBottom: "8px" }}>
          <button type="button" onClick={props.onClearHistory}>
            清空导出记录
          </button>
        </div>
      ) : null}
      {!props.hasSortedHistory ? <p style={{ margin: 0 }}>暂无导出记录</p> : null}
      {props.hasSortedHistory ? (
        <ul style={{ margin: 0, paddingLeft: "18px" }}>
          {props.pagedHistory.map((item) => (
            <li key={item.id}>
              <span>{item.fileName}</span>{" "}
              <span style={{ color: "var(--muted)" }}>（{props.formatHistoryTime(item.createdAt)}）</span>{" "}
              <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap", marginLeft: "6px" }}>
                {item.filters?.decision && item.filters.decision !== "all" ? (
                  <span>结果: {item.filters.decision === "APPROVED" ? "仅通过" : "仅驳回"}</span>
                ) : null}
                {item.filters?.actorKeyword ? <span>审批人: {item.filters.actorKeyword}</span> : null}
                {item.filters?.dateFrom || item.filters?.dateTo ? (
                  <span>
                    日期: {item.filters?.dateFrom || "start"} ~ {item.filters?.dateTo || "today"}
                  </span>
                ) : null}
              </div>{" "}
              <button
                type="button"
                aria-label={`复用筛选并导出-${item.fileName}`}
                onClick={() => props.onReuseHistoryExport(item)}
              >
                复用筛选并导出
              </button>{" "}
              <button
                type="button"
                aria-label={`重新下载-${item.fileName}`}
                onClick={() => props.onReDownloadHistory(item)}
              >
                重新下载
              </button>{" "}
              <button
                type="button"
                aria-label={`删除记录-${item.fileName}`}
                onClick={() => props.onRemoveHistoryItem(item.id)}
              >
                删除记录
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
