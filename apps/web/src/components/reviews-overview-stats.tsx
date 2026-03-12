import StatCard from "./stat-card";

type Props = {
  totalItems: number;
  selectedCount: number;
  approvedLogCount: number;
  rejectedLogCount: number;
  rangeLabel: string;
  rangeCount: number;
  rangeTrendText: string;
  onRangeChange: (range: "today" | "7d" | "month") => void;
};

export default function ReviewsOverviewStats({
  totalItems,
  selectedCount,
  approvedLogCount,
  rejectedLogCount,
  rangeLabel,
  rangeCount,
  rangeTrendText,
  onRangeChange
}: Props) {
  return (
    <section className="reviews-stat-grid">
      <StatCard label="待审批总数" value={totalItems} />
      <article style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
        <div className="reviews-stat-label">已选择</div>
        <strong className="reviews-stat-value">{selectedCount}</strong>
      </article>
      <article style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
        <div className="reviews-stat-label">最近审批</div>
        <strong className="reviews-stat-value">通过 {approvedLogCount} / 驳回 {rejectedLogCount}</strong>
      </article>
      <article style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
        <div className="reviews-stat-label">{rangeLabel}</div>
        <strong className="reviews-stat-value" data-testid="stats-range-count">
          {rangeCount}
        </strong>
        <div style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px" }} data-testid="stats-range-trend">
          {rangeTrendText}
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
          <button type="button" onClick={() => onRangeChange("today")}>今日</button>
          <button type="button" onClick={() => onRangeChange("7d")}>近7天</button>
          <button type="button" onClick={() => onRangeChange("month")}>本月</button>
        </div>
      </article>
    </section>
  );
}
