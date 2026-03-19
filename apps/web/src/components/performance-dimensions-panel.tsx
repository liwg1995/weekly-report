type PerformanceDimension = {
  id: number;
  version: number;
  key: string;
  name: string;
  weight: number;
  metricHint: string;
};

type PerformanceCycle = {
  id: number;
  name: string;
  dimensions: PerformanceDimension[];
};

type Props = {
  dimensionCycleId: string;
  onDimensionCycleIdChange: (value: string) => void;
  dimensionKey: string;
  onDimensionKeyChange: (value: string) => void;
  dimensionName: string;
  onDimensionNameChange: (value: string) => void;
  dimensionWeight: string;
  onDimensionWeightChange: (value: string) => void;
  dimensionMetricHint: string;
  onDimensionMetricHintChange: (value: string) => void;
  canCreateDimension: boolean;
  onCreateDimension: () => void;
  cycles: PerformanceCycle[];
  editingDimensionId: number | null;
  editingDimensionKey: string;
  onEditingDimensionKeyChange: (value: string) => void;
  editingDimensionName: string;
  onEditingDimensionNameChange: (value: string) => void;
  editingDimensionWeight: string;
  onEditingDimensionWeightChange: (value: string) => void;
  editingDimensionMetricHint: string;
  onEditingDimensionMetricHintChange: (value: string) => void;
  canSaveDimension: boolean;
  onBeginEditDimension: (dimensionId: number) => void;
  onSaveDimension: (dimensionId: number) => void;
  onCancelEditDimension: () => void;
  onRemoveDimension: (dimensionId: number) => void;
};

export default function PerformanceDimensionsPanel(props: Props) {
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
      <div className="ui-section-head">
        <h2>新增绩效维度</h2>
        <p className="ui-section-desc">建议先确定 3-5 个核心维度，再逐步完善权重与指标说明。</p>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <label>
          所属周期
          <select
            aria-label="维度所属周期"
            value={props.dimensionCycleId}
            onChange={(event) => props.onDimensionCycleIdChange(event.target.value)}
          >
            <option value="">请选择</option>
            {props.cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          维度Key
          <input
            aria-label="维度Key"
            value={props.dimensionKey}
            onChange={(event) => props.onDimensionKeyChange(event.target.value)}
          />
        </label>
        <label>
          维度名称
          <input
            aria-label="维度名称"
            value={props.dimensionName}
            onChange={(event) => props.onDimensionNameChange(event.target.value)}
          />
        </label>
        <label>
          权重
          <input
            aria-label="维度权重"
            type="number"
            min={1}
            max={100}
            value={props.dimensionWeight}
            onChange={(event) => props.onDimensionWeightChange(event.target.value)}
          />
        </label>
        <label>
          指标说明
          <input
            aria-label="维度指标说明"
            value={props.dimensionMetricHint}
            onChange={(event) => props.onDimensionMetricHintChange(event.target.value)}
          />
        </label>
        <button type="button" className="btn-primary" disabled={!props.canCreateDimension} onClick={props.onCreateDimension}>
          新增绩效维度
        </button>
      </div>

      <div style={{ marginTop: "10px" }}>
        {props.cycles.length === 0 ? <p style={{ marginBottom: 0 }}>暂无周期维度</p> : null}
        {props.cycles.map((cycle) => (
          <article key={cycle.id} className="ui-subsection-card">
            <div style={{ fontWeight: 600, marginBottom: "6px" }}>{cycle.name}</div>
            {cycle.dimensions.length === 0 ? <p style={{ margin: 0 }}>暂无维度</p> : null}
            <ul style={{ marginBottom: 0 }}>
              {cycle.dimensions.map((dimension) => (
                <li key={dimension.id}>
                  {props.editingDimensionId === dimension.id ? (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                      <label>
                        维度Key
                        <input
                          aria-label={`编辑维度Key-${dimension.id}`}
                          value={props.editingDimensionKey}
                          onChange={(event) => props.onEditingDimensionKeyChange(event.target.value)}
                        />
                      </label>
                      <label>
                        维度名称
                        <input
                          aria-label={`编辑维度名称-${dimension.id}`}
                          value={props.editingDimensionName}
                          onChange={(event) => props.onEditingDimensionNameChange(event.target.value)}
                        />
                      </label>
                      <label>
                        权重
                        <input
                          aria-label={`编辑维度权重-${dimension.id}`}
                          type="number"
                          min={1}
                          max={100}
                          value={props.editingDimensionWeight}
                          onChange={(event) => props.onEditingDimensionWeightChange(event.target.value)}
                        />
                      </label>
                      <label>
                        指标说明
                        <input
                          aria-label={`编辑维度指标说明-${dimension.id}`}
                          value={props.editingDimensionMetricHint}
                          onChange={(event) => props.onEditingDimensionMetricHintChange(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!props.canSaveDimension}
                        onClick={() => props.onSaveDimension(dimension.id)}
                        aria-label={`保存维度-${dimension.id}`}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={props.onCancelEditDimension}
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
                          onClick={() => props.onBeginEditDimension(dimension.id)}
                          aria-label={`编辑维度-${dimension.id}`}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => props.onRemoveDimension(dimension.id)}
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
      </div>
    </section>
  );
}
