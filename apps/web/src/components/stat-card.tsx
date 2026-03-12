type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <article className="ui-stat-card">
      <div className="ui-stat-label">{label}</div>
      <strong className="ui-stat-value">{value}</strong>
      {hint ? <p className="ui-stat-hint">{hint}</p> : null}
    </article>
  );
}
