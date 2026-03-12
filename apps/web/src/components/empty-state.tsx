type EmptyStateProps = {
  title: string;
  description?: string;
};

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="ui-empty-state">
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
    </section>
  );
}
