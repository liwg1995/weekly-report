type PerformanceTodo = {
  id: number;
  ownerRole: "SUPER_ADMIN" | "DEPT_ADMIN" | "MANAGER";
  title: string;
  done: boolean;
};

type Props = {
  todos: PerformanceTodo[];
  onUpdateTodoDone: (todoId: number, done: boolean) => void;
};

export default function PerformanceTodosPanel(props: Props) {
  return (
    <section
      style={{
        marginTop: "14px",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "12px",
        background: "var(--surface)"
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: "16px" }}>待办清单（占位）</h2>
      {props.todos.length === 0 ? <p style={{ marginBottom: 0 }}>暂无待办</p> : null}
      <ul style={{ margin: 0 }}>
        {props.todos.map((todo) => (
          <li key={todo.id}>
            <label>
              <input
                aria-label={`待办完成-${todo.id}`}
                type="checkbox"
                checked={todo.done}
                onChange={(event) => props.onUpdateTodoDone(todo.id, event.target.checked)}
              />
              [{todo.ownerRole}] {todo.title} {todo.done ? "(已完成)" : "(待确认)"}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
