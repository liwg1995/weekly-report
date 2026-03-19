type ReviewItem = {
  id: number;
  thisWeekText: string;
  risksText?: string;
  needsHelpText?: string;
  mentionLeader?: boolean;
  mentionComment?: string;
  status: string;
  dueAt?: string;
  isOverdue?: boolean;
  user?: {
    id: number;
    username: string;
    realName: string;
    leaderUserId?: number | null;
    leader?: {
      id: number;
      username: string;
      realName: string;
    } | null;
  } | null;
};

type Props = {
  loading: boolean;
  error: string;
  items: ReviewItem[];
  selectedIds: number[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchApprove: () => void;
  onBatchReject: () => void;
  onToggleSelected: (id: number, checked: boolean) => void;
  onApproveItem: (id: number) => void;
  onRejectItem: (id: number) => void;
  listPage: number;
  listTotalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  rejectTargetIds: number[];
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onConfirmReject: () => void;
  onCancelReject: () => void;
};

export default function ReviewsPendingPanel(props: Props) {
  const rejectItems = props.items.filter((item) => props.rejectTargetIds.includes(item.id));

  return (
    <>
      {!props.loading && !props.error && props.items.length === 0 ? <p>当前没有待审批周报。</p> : null}
      {!props.loading && !props.error && props.items.length > 0 ? (
        <>
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <button type="button" onClick={props.onSelectAll}>
              全选
            </button>
            <button type="button" onClick={props.onClearSelection}>
              取消全选
            </button>
            <button type="button" onClick={props.onBatchApprove}>
              批量通过
            </button>
            <button type="button" onClick={props.onBatchReject}>
              批量驳回
            </button>
          </div>
          <ul id="pending-list" style={{ display: "grid", gap: "12px", padding: 0, listStyle: "none" }}>
            {props.items.map((item) => (
              <li
                key={item.id}
                className={`review-item-card${item.isOverdue ? " is-overdue" : ""}`}
              >
                <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    aria-label={`选择周报-${item.id}`}
                    checked={props.selectedIds.includes(item.id)}
                    onChange={(event) => props.onToggleSelected(item.id, event.target.checked)}
                  />
                  <strong>#{item.id}</strong> {item.thisWeekText}
                </label>
                <div style={{ color: "var(--muted)", marginTop: "6px" }}>
                  状态: {item.status}
                </div>
                <div style={{ color: "var(--muted)", marginTop: "4px", fontSize: "12px" }}>
                  员工: {item.user?.realName || "-"}（{item.user?.username || "-"}） | 直属领导:{" "}
                  {item.user?.leader?.realName || item.user?.leader?.username || "未设置"}
                </div>
                {item.isOverdue ? (
                  <div className="review-item-overdue">
                    已逾期（应提时间：{item.dueAt ? new Date(item.dueAt).toLocaleString("zh-CN") : "未知"}）
                  </div>
                ) : null}
                {item.risksText?.trim() ? (
                  <div className="review-item-risk">风险提示：{item.risksText.trim()}</div>
                ) : null}
                {item.needsHelpText?.trim() ? (
                  <div className="review-item-help">协助诉求：{item.needsHelpText.trim()}</div>
                ) : null}
                {item.mentionLeader ? (
                  <div className="review-item-help">
                    @领导提醒{item.mentionComment?.trim() ? `：${item.mentionComment.trim()}` : ""}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button type="button" onClick={() => props.onApproveItem(item.id)}>
                    通过
                  </button>
                  <button type="button" onClick={() => props.onRejectItem(item.id)}>
                    驳回
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
            <button type="button" disabled={props.listPage <= 1} onClick={props.onPrevPage}>
              上一页
            </button>
            <button
              type="button"
              disabled={props.listPage >= props.listTotalPages}
              onClick={props.onNextPage}
            >
              下一页
            </button>
          </div>
        </>
      ) : null}
      {props.rejectTargetIds.length > 0 ? (
        <section
          style={{
            marginTop: "16px",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "12px",
            background: "var(--surface)"
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "16px" }}>填写驳回原因（{props.rejectTargetIds.length} 条）</h2>
          <p style={{ marginTop: 0, marginBottom: "6px", color: "var(--muted)" }}>将驳回以下周报：</p>
          <ul style={{ marginTop: 0, paddingLeft: "18px" }}>
            {rejectItems.map((item) => (
              <li key={item.id}>
                #{item.id} {item.thisWeekText}
              </li>
            ))}
          </ul>
          <textarea
            aria-label="驳回原因"
            value={props.rejectReason}
            onChange={(event) => props.onRejectReasonChange(event.target.value)}
            rows={3}
            style={{
              width: "100%",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "8px"
            }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button type="button" onClick={props.onConfirmReject}>
              确认驳回
            </button>
            <button type="button" onClick={props.onCancelReject}>
              取消
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
