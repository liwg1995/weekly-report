export default function ReviewsPerformancePlaceholder() {
  return (
    <section className="reviews-performance-placeholder">
      <h2 style={{ marginTop: 0, fontSize: "16px" }}>绩效考核（占位）</h2>
      <p>当前仅提供结构占位，后续将接入评分规则、周期配置与审批结果联动。</p>
      <p style={{ color: "var(--muted)", fontSize: "12px" }}>
        可先进入绩效占位页进行字段评审：<a href="/manager/performance">/manager/performance</a>
      </p>
    </section>
  );
}
