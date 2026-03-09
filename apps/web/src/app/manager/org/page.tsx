"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiClientError, apiGet, apiPatch, apiPost } from "../../../lib/api-client";
import { getSessionUser, logoutWithConfirm, requireRole } from "../../../lib/auth-session";

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
  leaderUserId: number | null;
  leader?: { id: number; username: string; realName: string } | null;
  userDepartments?: Array<{
    departmentId: number;
    roleInDept: string;
    isPrimary: boolean;
    department: { id: number; name: string };
  }>;
};

const weekdayOptions = [
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
  { label: "周日", value: 7 }
];

export default function ManagerOrgPage() {
  const sessionUser = getSessionUser();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [deptItems, setDeptItems] = useState<Department[]>([]);
  const [deptTotal, setDeptTotal] = useState(0);
  const [deptPage, setDeptPage] = useState(1);
  const [deptPageSize, setDeptPageSize] = useState(10);
  const [deptKeyword, setDeptKeyword] = useState("");
  const [deptKeywordInput, setDeptKeywordInput] = useState("");

  const [userItems, setUserItems] = useState<User[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [userKeyword, setUserKeyword] = useState("");
  const [userKeywordInput, setUserKeywordInput] = useState("");
  const [userDepartmentFilter, setUserDepartmentFilter] = useState("");

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentParentId, setNewDepartmentParentId] = useState("");
  const [newDepartmentManagerId, setNewDepartmentManagerId] = useState("");
  const [newDepartmentDueWeekday, setNewDepartmentDueWeekday] = useState("5");

  const [newUsername, setNewUsername] = useState("");
  const [newRealName, setNewRealName] = useState("");
  const [newUserLeaderId, setNewUserLeaderId] = useState("");

  const [assignUserId, setAssignUserId] = useState("");
  const [assignDepartmentId, setAssignDepartmentId] = useState("");
  const [assignRoleInDept, setAssignRoleInDept] = useState("member");
  const [assignIsPrimary, setAssignIsPrimary] = useState(true);

  const [leaderUserId, setLeaderUserId] = useState("");
  const [leaderLeaderId, setLeaderLeaderId] = useState("");

  const buildDepartmentQuery = () => {
    const params = new URLSearchParams();
    params.set("page", String(deptPage));
    params.set("pageSize", String(deptPageSize));
    if (deptKeyword.trim()) {
      params.set("keyword", deptKeyword.trim());
    }
    return `/api/departments?${params.toString()}`;
  };

  const buildUserQuery = () => {
    const params = new URLSearchParams();
    params.set("page", String(userPage));
    params.set("pageSize", String(userPageSize));
    if (userKeyword.trim()) {
      params.set("keyword", userKeyword.trim());
    }
    if (userDepartmentFilter) {
      params.set("departmentId", userDepartmentFilter);
    }
    return `/api/users?${params.toString()}`;
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [deptRes, userRes] = await Promise.all([
        apiGet<{
          items: Department[];
          total: number;
          page: number;
          pageSize: number;
        }>(buildDepartmentQuery()),
        apiGet<{
          items: User[];
          total: number;
          page: number;
          pageSize: number;
        }>(buildUserQuery())
      ]);
      setDeptItems(deptRes.items || []);
      setDeptTotal(deptRes.total || 0);
      setUserItems(userRes.items || []);
      setUserTotal(userRes.total || 0);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        setError("你当前没有组织管理权限。");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("加载组织数据失败，请稍后重试。");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const allowed = requireRole(["SUPER_ADMIN", "DEPT_ADMIN"], "/manager/reviews");
    if (!allowed) {
      return;
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, deptPage, deptPageSize, deptKeyword, userPage, userPageSize, userKeyword, userDepartmentFilter]);

  const submitCreateDepartment = async (event: FormEvent) => {
    event.preventDefault();
    if (!newDepartmentName.trim()) {
      setError("部门名称不能为空。");
      return;
    }
    setError("");
    setNotice("");
    try {
      await apiPost("/api/departments", {
        name: newDepartmentName.trim(),
        reportDueWeekday: Number(newDepartmentDueWeekday),
        parentId: newDepartmentParentId ? Number(newDepartmentParentId) : null,
        managerUserId: newDepartmentManagerId ? Number(newDepartmentManagerId) : null
      });
      setNotice("部门已创建");
      setNewDepartmentName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建部门失败");
    }
  };

  const submitCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!newUsername.trim() || !newRealName.trim()) {
      setError("账号和姓名不能为空。");
      return;
    }
    setError("");
    setNotice("");
    try {
      await apiPost("/api/users", {
        username: newUsername.trim(),
        realName: newRealName.trim(),
        leaderUserId: newUserLeaderId ? Number(newUserLeaderId) : null
      });
      setNotice("员工已创建（默认密码 123456）");
      setNewUsername("");
      setNewRealName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建员工失败");
    }
  };

  const submitAssignDepartment = async (event: FormEvent) => {
    event.preventDefault();
    if (!assignUserId || !assignDepartmentId) {
      setError("请选择员工与部门。");
      return;
    }
    setError("");
    setNotice("");
    try {
      await apiPost(`/api/users/${assignUserId}/departments`, {
        departmentId: Number(assignDepartmentId),
        roleInDept: assignRoleInDept,
        isPrimary: assignIsPrimary
      });
      setNotice("员工归属已更新");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "员工归属设置失败");
    }
  };

  const submitSetLeader = async (event: FormEvent) => {
    event.preventDefault();
    if (!leaderUserId) {
      setError("请选择员工。");
      return;
    }
    setError("");
    setNotice("");
    try {
      await apiPatch(`/api/users/${leaderUserId}/leader`, {
        leaderUserId: leaderLeaderId ? Number(leaderLeaderId) : null
      });
      setNotice("直属领导已更新");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "直属领导设置失败");
    }
  };

  const updateDepartmentDueWeekday = async (departmentId: number, value: number) => {
    setError("");
    setNotice("");
    try {
      await apiPatch(`/api/departments/${departmentId}`, {
        reportDueWeekday: value
      });
      setNotice("部门提交日已更新");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新部门失败");
    }
  };

  if (!ready) {
    return null;
  }

  return (
    <main style={{ padding: "24px", display: "grid", gap: "16px" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap"
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "24px" }}>组织管理台</h1>
          <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
            当前用户：{sessionUser?.username}（{sessionUser?.roles.join(" / ") || "未知角色"}）
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" onClick={() => (window.location.href = "/manager/reviews")}>
            审批台
          </button>
          <button type="button" onClick={() => (window.location.href = "/manager/performance")}>
            绩效配置
          </button>
          <button type="button" onClick={() => logoutWithConfirm()}>
            退出登录
          </button>
        </div>
      </header>

      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--primary-strong)", margin: 0 }}>{notice}</p> : null}

      <section style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "12px" }}>
        <h2 style={{ marginTop: 0 }}>部门设置</h2>
        <form onSubmit={submitCreateDepartment} style={{ display: "grid", gap: "8px" }}>
          <input
            placeholder="部门名称"
            value={newDepartmentName}
            onChange={(event) => setNewDepartmentName(event.target.value)}
          />
          <select
            value={newDepartmentParentId}
            onChange={(event) => setNewDepartmentParentId(event.target.value)}
          >
            <option value="">无上级部门</option>
            {deptItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={newDepartmentManagerId}
            onChange={(event) => setNewDepartmentManagerId(event.target.value)}
          >
            <option value="">未设置负责人</option>
            {userItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.realName}({item.username})
              </option>
            ))}
          </select>
          <select
            value={newDepartmentDueWeekday}
            onChange={(event) => setNewDepartmentDueWeekday(event.target.value)}
          >
            {weekdayOptions.map((option) => (
              <option key={option.value} value={String(option.value)}>
                默认提交日：{option.label}
              </option>
            ))}
          </select>
          <button type="submit">创建部门</button>
        </form>

        <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            placeholder="搜索部门"
            value={deptKeywordInput}
            onChange={(event) => setDeptKeywordInput(event.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              setDeptPage(1);
              setDeptKeyword(deptKeywordInput);
            }}
          >
            查询
          </button>
          <span>
            总数：{deptTotal}，第 {deptPage} 页
          </span>
          <button type="button" disabled={deptPage <= 1} onClick={() => setDeptPage((value) => value - 1)}>
            上一页
          </button>
          <button
            type="button"
            disabled={deptPage * deptPageSize >= deptTotal}
            onClick={() => setDeptPage((value) => value + 1)}
          >
            下一页
          </button>
        </div>

        <ul style={{ marginBottom: 0 }}>
          {deptItems.map((item) => (
            <li key={item.id} style={{ marginTop: "8px" }}>
              #{item.id} {item.name} / 上级：{item.parentId ?? "无"} / 负责人：
              {item.managerUserId ?? "未设置"} / 提交日：
              <select
                value={String(item.reportDueWeekday)}
                onChange={(event) => void updateDepartmentDueWeekday(item.id, Number(event.target.value))}
              >
                {weekdayOptions.map((option) => (
                  <option key={option.value} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "12px" }}>
        <h2 style={{ marginTop: 0 }}>员工与归属设置</h2>
        <form onSubmit={submitCreateUser} style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
          <input
            placeholder="登录账号（username）"
            value={newUsername}
            onChange={(event) => setNewUsername(event.target.value)}
          />
          <input
            placeholder="姓名"
            value={newRealName}
            onChange={(event) => setNewRealName(event.target.value)}
          />
          <select value={newUserLeaderId} onChange={(event) => setNewUserLeaderId(event.target.value)}>
            <option value="">直属领导（可选）</option>
            {userItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.realName}({item.username})
              </option>
            ))}
          </select>
          <button type="submit">创建员工</button>
        </form>

        <form onSubmit={submitAssignDepartment} style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
          <select value={assignUserId} onChange={(event) => setAssignUserId(event.target.value)}>
            <option value="">选择员工</option>
            {userItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.realName}({item.username})
              </option>
            ))}
          </select>
          <select value={assignDepartmentId} onChange={(event) => setAssignDepartmentId(event.target.value)}>
            <option value="">选择归属部门</option>
            {deptItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={assignRoleInDept} onChange={(event) => setAssignRoleInDept(event.target.value)}>
            <option value="member">员工(member)</option>
            <option value="admin">部门管理员(admin)</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={assignIsPrimary}
              onChange={(event) => setAssignIsPrimary(event.target.checked)}
            />
            设为主部门
          </label>
          <button type="submit">保存员工归属</button>
        </form>

        <form onSubmit={submitSetLeader} style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
          <select value={leaderUserId} onChange={(event) => setLeaderUserId(event.target.value)}>
            <option value="">选择员工</option>
            {userItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.realName}({item.username})
              </option>
            ))}
          </select>
          <select value={leaderLeaderId} onChange={(event) => setLeaderLeaderId(event.target.value)}>
            <option value="">清空直属领导</option>
            {userItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.realName}({item.username})
              </option>
            ))}
          </select>
          <button type="submit">设置直属领导</button>
        </form>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            placeholder="搜索员工（账号/姓名）"
            value={userKeywordInput}
            onChange={(event) => setUserKeywordInput(event.target.value)}
          />
          <select value={userDepartmentFilter} onChange={(event) => setUserDepartmentFilter(event.target.value)}>
            <option value="">全部部门</option>
            {deptItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setUserPage(1);
              setUserKeyword(userKeywordInput);
            }}
          >
            查询
          </button>
          <span>
            总数：{userTotal}，第 {userPage} 页
          </span>
          <button type="button" disabled={userPage <= 1} onClick={() => setUserPage((value) => value - 1)}>
            上一页
          </button>
          <button
            type="button"
            disabled={userPage * userPageSize >= userTotal}
            onClick={() => setUserPage((value) => value + 1)}
          >
            下一页
          </button>
        </div>

        {loading ? <p>加载中...</p> : null}
        <ul style={{ marginBottom: 0 }}>
          {userItems.map((item) => (
            <li key={item.id} style={{ marginTop: "8px" }}>
              #{item.id} {item.realName}({item.username}) / 直属领导：
              {item.leader ? `${item.leader.realName}(${item.leader.username})` : "未设置"} / 部门：
              {(item.userDepartments || [])
                .map((relation) => `${relation.department.name}${relation.isPrimary ? "(主)" : ""}/${relation.roleInDept}`)
                .join("，") || "未归属"}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
