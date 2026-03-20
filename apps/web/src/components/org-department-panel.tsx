import type { FormEvent } from "react";
import DataTable from "./data-table";
import FilterBar from "./filter-bar";
import FormField from "./form-field";

type Department = {
  id: number;
  name: string;
  parentId: number | null;
  managerUserId: number | null;
  reportDueWeekday: number;
};

type User = {
  id: number;
  username: string;
  realName: string;
};

type WeekdayOption = {
  label: string;
  value: number;
};

type Props = {
  submitCreateDepartment: (event: FormEvent) => void;
  newDepartmentName: string;
  onNewDepartmentNameChange: (value: string) => void;
  newDepartmentParentId: string;
  onNewDepartmentParentIdChange: (value: string) => void;
  newDepartmentManagerId: string;
  onNewDepartmentManagerIdChange: (value: string) => void;
  newDepartmentDueWeekday: string;
  onNewDepartmentDueWeekdayChange: (value: string) => void;
  deptItems: Department[];
  userItems: User[];
  weekdayOptions: WeekdayOption[];
  deptKeywordInput: string;
  onDeptKeywordInputChange: (value: string) => void;
  onSearchDepartment: () => void;
  deptTotal: number;
  deptPage: number;
  deptPageSize: number;
  onPrevDeptPage: () => void;
  onNextDeptPage: () => void;
  onUpdateDepartmentDueWeekday: (departmentId: number, value: number) => void;
};

export default function OrgDepartmentPanel(props: Props) {
  return (
    <section className="ui-panel">
      <div className="ui-section-head">
        <h2>部门设置</h2>
        <p className="ui-section-desc">先创建部门结构，再配置负责人与默认周报提交日。</p>
      </div>
      <form onSubmit={props.submitCreateDepartment} style={{ display: "grid", gap: "8px" }}>
        <FormField label="部门名称">
          <input
            placeholder="部门名称"
            value={props.newDepartmentName}
            onChange={(event) => props.onNewDepartmentNameChange(event.target.value)}
          />
        </FormField>
        <FormField label="上级部门">
          <select
            value={props.newDepartmentParentId}
            onChange={(event) => props.onNewDepartmentParentIdChange(event.target.value)}
          >
            <option value="">无上级部门</option>
            {props.deptItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="部门负责人">
          <select
            value={props.newDepartmentManagerId}
            onChange={(event) => props.onNewDepartmentManagerIdChange(event.target.value)}
          >
            <option value="">未设置负责人</option>
            {props.userItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.realName}({item.username})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="默认提交日">
          <select
            value={props.newDepartmentDueWeekday}
            onChange={(event) => props.onNewDepartmentDueWeekdayChange(event.target.value)}
          >
            {props.weekdayOptions.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <button type="submit" className="btn-primary">创建部门</button>
      </form>

      <p className="ui-section-desc" style={{ margin: "10px 0 8px" }}>
        支持按关键词分页查看部门，并在列表里直接调整提交日。
      </p>
      <FilterBar>
        <input
          placeholder="搜索部门"
          value={props.deptKeywordInput}
          onChange={(event) => props.onDeptKeywordInputChange(event.target.value)}
        />
        <button type="button" onClick={props.onSearchDepartment}>
          查询
        </button>
        <span>
          总数：{props.deptTotal}，第 {props.deptPage} 页
        </span>
        <button type="button" disabled={props.deptPage <= 1} onClick={props.onPrevDeptPage}>
          上一页
        </button>
        <button
          type="button"
          disabled={props.deptPage * props.deptPageSize >= props.deptTotal}
          onClick={props.onNextDeptPage}
        >
          下一页
        </button>
      </FilterBar>

      <div style={{ marginTop: "10px" }}>
        <DataTable
          columns={["ID", "部门", "上级", "负责人", "提交日"]}
          rows={props.deptItems.map((item) => [
            `#${item.id}`,
            item.name,
            item.parentId ? `#${item.parentId}` : "无",
            item.managerUserId ? `#${item.managerUserId}` : "未设置",
            <select
              key={`weekday-${item.id}`}
              value={String(item.reportDueWeekday)}
              onChange={(event) =>
                props.onUpdateDepartmentDueWeekday(item.id, Number(event.target.value))
              }
            >
              {props.weekdayOptions.map((option) => (
                <option key={option.value} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          ])}
          emptyText="暂无部门"
        />
      </div>
    </section>
  );
}
