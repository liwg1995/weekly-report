import type { FormEvent } from "react";
import DataTable from "./data-table";
import FilterBar from "./filter-bar";

type Department = {
  id: number;
  name: string;
};

type User = {
  id: number;
  username: string;
  realName: string;
  leader?: { id: number; username: string; realName: string } | null;
  userDepartments?: Array<{
    departmentId: number;
    roleInDept: string;
    isPrimary: boolean;
    department: { id: number; name: string };
  }>;
};

type Props = {
  submitCreateUser: (event: FormEvent) => void;
  newUsername: string;
  onNewUsernameChange: (value: string) => void;
  newRealName: string;
  onNewRealNameChange: (value: string) => void;
  newUserLeaderId: string;
  onNewUserLeaderIdChange: (value: string) => void;
  userItems: User[];
  submitAssignDepartment: (event: FormEvent) => void;
  assignUserId: string;
  onAssignUserIdChange: (value: string) => void;
  assignDepartmentId: string;
  onAssignDepartmentIdChange: (value: string) => void;
  assignRoleInDept: string;
  onAssignRoleInDeptChange: (value: string) => void;
  assignIsPrimary: boolean;
  onAssignIsPrimaryChange: (checked: boolean) => void;
  deptItems: Department[];
  submitSetLeader: (event: FormEvent) => void;
  leaderUserId: string;
  onLeaderUserIdChange: (value: string) => void;
  leaderLeaderId: string;
  onLeaderLeaderIdChange: (value: string) => void;
  userKeywordInput: string;
  onUserKeywordInputChange: (value: string) => void;
  userDepartmentFilter: string;
  onUserDepartmentFilterChange: (value: string) => void;
  onSearchUser: () => void;
  userTotal: number;
  userPage: number;
  userPageSize: number;
  onPrevUserPage: () => void;
  onNextUserPage: () => void;
  loading: boolean;
};

export default function OrgUserPanel(props: Props) {
  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "12px" }}>
      <div className="ui-section-head">
        <h2>员工与归属设置</h2>
        <p className="ui-section-desc">按“创建员工 → 绑定部门 → 设置直属领导”的顺序配置更顺手。</p>
      </div>

      <div className="ui-subsection-card">
        <p className="ui-section-desc" style={{ marginBottom: "8px" }}>1. 创建员工账号</p>
        <form onSubmit={props.submitCreateUser} style={{ display: "grid", gap: "8px", marginBottom: 0 }}>
          <input
            placeholder="登录账号（username）"
            value={props.newUsername}
            onChange={(event) => props.onNewUsernameChange(event.target.value)}
          />
          <input
            placeholder="姓名"
            value={props.newRealName}
            onChange={(event) => props.onNewRealNameChange(event.target.value)}
          />
          <select
            value={props.newUserLeaderId}
            onChange={(event) => props.onNewUserLeaderIdChange(event.target.value)}
          >
            <option value="">直属领导（可选）</option>
            {props.userItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.realName}({item.username})
              </option>
            ))}
          </select>
          <button type="submit">创建员工</button>
        </form>
      </div>

      <div className="ui-subsection-card">
        <p className="ui-section-desc" style={{ marginBottom: "8px" }}>2. 设置部门归属</p>
        <form onSubmit={props.submitAssignDepartment} style={{ display: "grid", gap: "8px", marginBottom: 0 }}>
          <select value={props.assignUserId} onChange={(event) => props.onAssignUserIdChange(event.target.value)}>
            <option value="">选择员工</option>
            {props.userItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.realName}({item.username})
              </option>
            ))}
          </select>
          <select
            value={props.assignDepartmentId}
            onChange={(event) => props.onAssignDepartmentIdChange(event.target.value)}
          >
            <option value="">选择归属部门</option>
            {props.deptItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={props.assignRoleInDept}
            onChange={(event) => props.onAssignRoleInDeptChange(event.target.value)}
          >
            <option value="member">员工(member)</option>
            <option value="admin">部门管理员(admin)</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={props.assignIsPrimary}
              onChange={(event) => props.onAssignIsPrimaryChange(event.target.checked)}
            />
            设为主部门
          </label>
          <button type="submit">保存员工归属</button>
        </form>
      </div>

      <div className="ui-subsection-card">
        <p className="ui-section-desc" style={{ marginBottom: "8px" }}>3. 设置直属领导</p>
        <form onSubmit={props.submitSetLeader} style={{ display: "grid", gap: "8px", marginBottom: 0 }}>
          <select value={props.leaderUserId} onChange={(event) => props.onLeaderUserIdChange(event.target.value)}>
            <option value="">选择员工</option>
            {props.userItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.realName}({item.username})
              </option>
            ))}
          </select>
          <select value={props.leaderLeaderId} onChange={(event) => props.onLeaderLeaderIdChange(event.target.value)}>
            <option value="">清空直属领导</option>
            {props.userItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.realName}({item.username})
              </option>
            ))}
          </select>
          <button type="submit">设置直属领导</button>
        </form>
      </div>

      <p className="ui-section-desc" style={{ margin: "2px 0 8px" }}>
        支持按账号/姓名/部门筛选员工，并分页浏览归属关系。
      </p>

      <FilterBar>
        <input
          placeholder="搜索员工（账号/姓名）"
          value={props.userKeywordInput}
          onChange={(event) => props.onUserKeywordInputChange(event.target.value)}
        />
        <select
          value={props.userDepartmentFilter}
          onChange={(event) => props.onUserDepartmentFilterChange(event.target.value)}
        >
          <option value="">全部部门</option>
          {props.deptItems.map((item) => (
            <option key={item.id} value={String(item.id)}>
              {item.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={props.onSearchUser}>
          查询
        </button>
        <span>
          总数：{props.userTotal}，第 {props.userPage} 页
        </span>
        <button type="button" disabled={props.userPage <= 1} onClick={props.onPrevUserPage}>
          上一页
        </button>
        <button
          type="button"
          disabled={props.userPage * props.userPageSize >= props.userTotal}
          onClick={props.onNextUserPage}
        >
          下一页
        </button>
      </FilterBar>

      {props.loading ? <p>加载中...</p> : null}
      <DataTable
        columns={["ID", "姓名", "账号", "直属领导", "部门归属"]}
        rows={props.userItems.map((item) => [
          `#${item.id}`,
          item.realName,
          item.username,
          item.leader ? `${item.leader.realName}(${item.leader.username})` : "未设置",
          (item.userDepartments || [])
            .map((relation) => `${relation.department.name}${relation.isPrimary ? "(主)" : ""}/${relation.roleInDept}`)
            .join("，") || "未归属"
        ])}
        emptyText="暂无员工数据"
      />
    </section>
  );
}
