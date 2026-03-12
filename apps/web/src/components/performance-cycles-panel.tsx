type PerformanceCycle = {
  id: number;
  name: string;
  version: number;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
};

type Props = {
  cycleName: string;
  onCycleNameChange: (value: string) => void;
  cycleStartDate: string;
  onCycleStartDateChange: (value: string) => void;
  cycleEndDate: string;
  onCycleEndDateChange: (value: string) => void;
  cycleStatus: "DRAFT" | "ACTIVE" | "CLOSED";
  onCycleStatusChange: (value: "DRAFT" | "ACTIVE" | "CLOSED") => void;
  canCreateCycle: boolean;
  onCreateCycle: () => void;
  cycles: PerformanceCycle[];
  editingCycleId: number | null;
  editingCycleName: string;
  onEditingCycleNameChange: (value: string) => void;
  editingCycleStartDate: string;
  onEditingCycleStartDateChange: (value: string) => void;
  editingCycleEndDate: string;
  onEditingCycleEndDateChange: (value: string) => void;
  editingCycleStatus: "DRAFT" | "ACTIVE" | "CLOSED";
  onEditingCycleStatusChange: (value: "DRAFT" | "ACTIVE" | "CLOSED") => void;
  canSaveCycle: boolean;
  onBeginEditCycle: (cycleId: number) => void;
  onSaveCycle: (cycleId: number) => void;
  onCancelEditCycle: () => void;
  onRemoveCycle: (cycleId: number) => void;
};

export default function PerformanceCyclesPanel(props: Props) {
  return (
    <>
      <section
        style={{
          marginTop: "14px",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "12px",
          background: "var(--surface)"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "16px" }}>配置绩效周期</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <label>
            周期名称
            <input
              aria-label="绩效周期名称"
              value={props.cycleName}
              onChange={(event) => props.onCycleNameChange(event.target.value)}
            />
          </label>
          <label>
            开始日期
            <input
              aria-label="周期开始日期"
              type="date"
              value={props.cycleStartDate}
              onChange={(event) => props.onCycleStartDateChange(event.target.value)}
            />
          </label>
          <label>
            结束日期
            <input
              aria-label="周期结束日期"
              type="date"
              value={props.cycleEndDate}
              onChange={(event) => props.onCycleEndDateChange(event.target.value)}
            />
          </label>
          <label>
            状态
            <select
              value={props.cycleStatus}
              onChange={(event) =>
                props.onCycleStatusChange(event.target.value as "DRAFT" | "ACTIVE" | "CLOSED")
              }
            >
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
          <button type="button" disabled={!props.canCreateCycle} onClick={props.onCreateCycle}>
            创建绩效周期
          </button>
        </div>
      </section>

      <section
        style={{
          marginTop: "14px",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "12px",
          background: "var(--surface)"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "16px" }}>当前草案周期</h2>
        {props.cycles.length === 0 ? <p style={{ marginBottom: 0 }}>暂无草案周期</p> : null}
        {props.cycles.map((cycle) => (
          <article
            key={cycle.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "10px",
              marginBottom: "10px"
            }}
          >
            <div>
              <strong>{cycle.name}</strong>
              <span style={{ marginLeft: "8px", color: "var(--muted)" }}>
                {cycle.startDate.slice(0, 10)} ~ {cycle.endDate.slice(0, 10)} / {cycle.status}
              </span>
            </div>
            {props.editingCycleId === cycle.id ? (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                <label>
                  周期名称
                  <input
                    aria-label={`编辑周期名称-${cycle.id}`}
                    value={props.editingCycleName}
                    onChange={(event) => props.onEditingCycleNameChange(event.target.value)}
                  />
                </label>
                <label>
                  开始日期
                  <input
                    aria-label={`编辑周期开始日期-${cycle.id}`}
                    type="date"
                    value={props.editingCycleStartDate}
                    onChange={(event) => props.onEditingCycleStartDateChange(event.target.value)}
                  />
                </label>
                <label>
                  结束日期
                  <input
                    aria-label={`编辑周期结束日期-${cycle.id}`}
                    type="date"
                    value={props.editingCycleEndDate}
                    onChange={(event) => props.onEditingCycleEndDateChange(event.target.value)}
                  />
                </label>
                <label>
                  状态
                  <select
                    value={props.editingCycleStatus}
                    onChange={(event) =>
                      props.onEditingCycleStatusChange(
                        event.target.value as "DRAFT" | "ACTIVE" | "CLOSED"
                      )
                    }
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!props.canSaveCycle}
                  onClick={() => props.onSaveCycle(cycle.id)}
                  aria-label={`保存周期-${cycle.id}`}
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={props.onCancelEditCycle}
                  aria-label={`取消编辑周期-${cycle.id}`}
                >
                  取消
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => props.onBeginEditCycle(cycle.id)}
                  aria-label={`编辑周期-${cycle.id}`}
                >
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => props.onRemoveCycle(cycle.id)}
                  aria-label={`删除周期-${cycle.id}`}
                >
                  删除
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
