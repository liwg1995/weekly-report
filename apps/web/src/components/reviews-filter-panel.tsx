type ReviewSortMode = "default" | "mentionFirst" | "overdueFirst";

type DepartmentOption = {
  id: number;
  name: string;
};

type LeaderOption = {
  id: number;
  username: string;
  realName: string;
};

type Props = {
  listKeywordInput: string;
  onKeywordInputChange: (value: string) => void;
  listPageSize: number;
  onPageSizeChange: (size: number) => void;
  listDepartmentId?: number;
  onDepartmentChange: (id?: number) => void;
  filteredDepartments: DepartmentOption[];
  filterDepartmentKeyword: string;
  onFilterDepartmentKeywordChange: (value: string) => void;
  listLeaderUserId?: number;
  onLeaderUserIdChange: (id?: number) => void;
  filteredLeaders: LeaderOption[];
  filterLeaderKeyword: string;
  onFilterLeaderKeywordChange: (value: string) => void;
  filterOptionsLoading: boolean;
  hasFilterOptions: boolean;
  onRefreshFilterOptions: () => void;
  filterOptionsUpdatedAtText: string;
  listOverdueFirst: boolean;
  onOverdueFirstChange: (checked: boolean) => void;
  listMentionLeaderOnly: boolean;
  onMentionLeaderOnlyChange: (checked: boolean) => void;
  listMentionFirst: boolean;
  onMentionFirstChange: (checked: boolean) => void;
  listMyDirectOnly: boolean;
  onMyDirectOnlyChange: (checked: boolean) => void;
  listSortMode: ReviewSortMode;
  onSortModeChange: (mode: ReviewSortMode) => void;
  onPresetMyPending: () => void;
  onPresetMentionPriority: () => void;
  onOnlyOverdue: () => void;
  onOnlyMentionLeader: () => void;
  onMentionFirstSort: () => void;
  onOnlyMyDirect: () => void;
  onSearch: () => void;
  onSaveDefaults: () => void;
  onRestoreDefaults: () => void;
  onReset: () => void;
  listPage: number;
  listTotalPages: number;
  listStart: number;
  listEnd: number;
  totalItems: number;
  defaultPageSize: number;
  activeFilterTagsCount: number;
  listKeyword: string;
  selectedDepartmentLabel?: string;
  selectedLeader?: LeaderOption;
  onClearKeywordTag: () => void;
  onClearDepartmentTag: () => void;
  onClearLeaderTag: () => void;
  onClearOverdueTag: () => void;
  onClearMentionLeaderTag: () => void;
  onClearMentionFirstTag: () => void;
  onClearMyDirectTag: () => void;
  onClearAllTags: () => void;
};

export default function ReviewsFilterPanel(props: Props) {
  return (
    <section className="reviews-filter-panel" style={{ marginBottom: "12px", padding: "12px" }}>
      <h2 style={{ marginTop: 0, fontSize: "16px" }}>列表筛选</h2>
      <div className="reviews-filter-controls" style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
        <input
          aria-label="周报关键词"
          placeholder="关键词（内容/姓名/账号）"
          value={props.listKeywordInput}
          onChange={(event) => props.onKeywordInputChange(event.target.value)}
        />
        <select
          aria-label="每页条数"
          value={String(props.listPageSize)}
          onChange={(event) => props.onPageSizeChange(Number(event.target.value))}
        >
          <option value="10">10条/页</option>
          <option value="20">20条/页</option>
          <option value="50">50条/页</option>
        </select>
        <select
          aria-label="部门筛选"
          value={props.listDepartmentId ? String(props.listDepartmentId) : ""}
          onChange={(event) => props.onDepartmentChange(event.target.value ? Number(event.target.value) : undefined)}
        >
          <option value="">全部部门</option>
          {props.filteredDepartments.map((dept) => (
            <option key={dept.id} value={String(dept.id)}>
              {dept.name}
            </option>
          ))}
        </select>
        <input
          aria-label="部门选项搜索"
          placeholder="搜索部门"
          value={props.filterDepartmentKeyword}
          onChange={(event) => props.onFilterDepartmentKeywordChange(event.target.value)}
          style={{ width: "120px" }}
        />
        <select
          aria-label="直属领导筛选"
          value={props.listLeaderUserId ? String(props.listLeaderUserId) : ""}
          onChange={(event) => props.onLeaderUserIdChange(event.target.value ? Number(event.target.value) : undefined)}
        >
          <option value="">全部直属领导</option>
          {props.filteredLeaders.map((leader) => (
            <option key={leader.id} value={String(leader.id)}>
              {leader.realName}（{leader.username}）
            </option>
          ))}
        </select>
        <input
          aria-label="直属领导选项搜索"
          placeholder="搜索领导"
          value={props.filterLeaderKeyword}
          onChange={(event) => props.onFilterLeaderKeywordChange(event.target.value)}
          style={{ width: "120px" }}
        />
        <button type="button" onClick={props.onRefreshFilterOptions} disabled={props.filterOptionsLoading}>
          {props.filterOptionsLoading
            ? "加载中..."
            : props.hasFilterOptions
              ? "刷新筛选项"
              : "加载筛选项"}
        </button>
        <span style={{ color: "var(--muted)", fontSize: "12px" }}>
          筛选项刷新：{props.filterOptionsUpdatedAtText}
        </span>
        <label>
          <input
            type="checkbox"
            aria-label="逾期优先"
            checked={props.listOverdueFirst}
            onChange={(event) => props.onOverdueFirstChange(event.target.checked)}
          />{" "}
          逾期优先
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="@领导提醒"
            checked={props.listMentionLeaderOnly}
            onChange={(event) => props.onMentionLeaderOnlyChange(event.target.checked)}
          />{" "}
          @领导提醒
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="提醒优先"
            checked={props.listMentionFirst}
            onChange={(event) => props.onMentionFirstChange(event.target.checked)}
          />{" "}
          提醒优先
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="仅我直属团队"
            checked={props.listMyDirectOnly}
            onChange={(event) => props.onMyDirectOnlyChange(event.target.checked)}
          />{" "}
          仅我直属团队
        </label>
        <select
          aria-label="审批排序"
          value={props.listSortMode}
          onChange={(event) => props.onSortModeChange(event.target.value as ReviewSortMode)}
        >
          <option value="default">默认顺序</option>
          <option value="mentionFirst">提醒优先</option>
          <option value="overdueFirst">逾期优先</option>
        </select>
        <button type="button" onClick={props.onPresetMyPending}>
          待我审批预设
        </button>
        <button type="button" onClick={props.onPresetMentionPriority}>
          @提醒优先预设
        </button>
        <button type="button" onClick={props.onOnlyOverdue}>
          只看逾期
        </button>
        <button type="button" onClick={props.onOnlyMentionLeader}>
          只看@领导提醒
        </button>
        <button type="button" onClick={props.onMentionFirstSort}>
          提醒优先排序
        </button>
        <button type="button" onClick={props.onOnlyMyDirect}>
          仅我直属团队
        </button>
        <button type="button" className="btn-primary" onClick={props.onSearch}>
          查询
        </button>
        <button type="button" className="btn-primary" onClick={props.onSaveDefaults}>
          保存为默认筛选
        </button>
        <button type="button" onClick={props.onRestoreDefaults}>
          恢复默认筛选
        </button>
        <button type="button" onClick={props.onReset}>
          重置
        </button>
        <span style={{ color: "var(--muted)", fontSize: "12px" }}>
          第 {props.listPage} / {props.listTotalPages} 页，显示 {props.listStart}-{props.listEnd} / {props.totalItems}
        </span>
        <span style={{ color: "var(--muted)", fontSize: "12px" }}>默认：{props.defaultPageSize}条</span>
      </div>
      {props.activeFilterTagsCount > 0 ? (
        <div className="review-filter-tags">
          {props.listKeyword ? (
            <button type="button" className="review-filter-tag" onClick={props.onClearKeywordTag}>
              关键词：{props.listKeyword} ×
            </button>
          ) : null}
          {props.selectedDepartmentLabel ? (
            <button type="button" className="review-filter-tag" onClick={props.onClearDepartmentTag}>
              部门：{props.selectedDepartmentLabel} ×
            </button>
          ) : null}
          {props.selectedLeader ? (
            <button type="button" className="review-filter-tag" onClick={props.onClearLeaderTag}>
              直属领导：{props.selectedLeader.realName}（{props.selectedLeader.username}） ×
            </button>
          ) : null}
          {props.listOverdueFirst ? (
            <button type="button" className="review-filter-tag" onClick={props.onClearOverdueTag}>
              逾期优先 ×
            </button>
          ) : null}
          {props.listMentionLeaderOnly ? (
            <button type="button" className="review-filter-tag" onClick={props.onClearMentionLeaderTag}>
              @领导提醒 ×
            </button>
          ) : null}
          {props.listMentionFirst ? (
            <button type="button" className="review-filter-tag" onClick={props.onClearMentionFirstTag}>
              提醒优先排序 ×
            </button>
          ) : null}
          {props.listMyDirectOnly ? (
            <button type="button" className="review-filter-tag" onClick={props.onClearMyDirectTag}>
              仅我直属团队 ×
            </button>
          ) : null}
          <button type="button" className="review-filter-clear" onClick={props.onClearAllTags}>
            清空全部筛选
          </button>
        </div>
      ) : null}
    </section>
  );
}
