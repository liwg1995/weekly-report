"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiClientError, apiGet, apiPatch, apiPost } from "../../../lib/api-client";
import AppShell from "../../../components/app-shell";
import OrgDepartmentPanel from "../../../components/org-department-panel";
import OrgUserPanel from "../../../components/org-user-panel";
import PageHeader from "../../../components/page-header";
import ResultState from "../../../components/result-state";
import { useAuthGuard } from "../../../lib/use-auth-guard";

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
  const guard = useAuthGuard({
    currentPath: "/manager/org",
    requiredAny: ["org:read"]
  });
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
    if (!guard.ready) {
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard.ready, deptPage, deptPageSize, deptKeyword, userPage, userPageSize, userKeyword, userDepartmentFilter]);

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

  if (!guard.ready || guard.blocked) {
    return null;
  }

  return (
    <AppShell
      workspace="admin-workspace"
      pageTitle="组织管理"
      pageDescription="配置部门、员工归属与汇报关系"
    >
      <div style={{ display: "grid", gap: "16px" }}>
        <PageHeader
          title="组织管理台"
          subtitle="按部门、人员、汇报关系拆分配置，减少长页面操作负担。"
        />
        {error ? <ResultState type="error" message={error} /> : null}
        {notice ? <ResultState type="success" message={notice} /> : null}

        <OrgDepartmentPanel
          submitCreateDepartment={submitCreateDepartment}
          newDepartmentName={newDepartmentName}
          onNewDepartmentNameChange={setNewDepartmentName}
          newDepartmentParentId={newDepartmentParentId}
          onNewDepartmentParentIdChange={setNewDepartmentParentId}
          newDepartmentManagerId={newDepartmentManagerId}
          onNewDepartmentManagerIdChange={setNewDepartmentManagerId}
          newDepartmentDueWeekday={newDepartmentDueWeekday}
          onNewDepartmentDueWeekdayChange={setNewDepartmentDueWeekday}
          deptItems={deptItems}
          userItems={userItems}
          weekdayOptions={weekdayOptions}
          deptKeywordInput={deptKeywordInput}
          onDeptKeywordInputChange={setDeptKeywordInput}
          onSearchDepartment={() => {
            setDeptPage(1);
            setDeptKeyword(deptKeywordInput);
          }}
          deptTotal={deptTotal}
          deptPage={deptPage}
          deptPageSize={deptPageSize}
          onPrevDeptPage={() => setDeptPage((value) => value - 1)}
          onNextDeptPage={() => setDeptPage((value) => value + 1)}
          onUpdateDepartmentDueWeekday={(departmentId, value) =>
            void updateDepartmentDueWeekday(departmentId, value)
          }
        />

        <OrgUserPanel
          submitCreateUser={submitCreateUser}
          newUsername={newUsername}
          onNewUsernameChange={setNewUsername}
          newRealName={newRealName}
          onNewRealNameChange={setNewRealName}
          newUserLeaderId={newUserLeaderId}
          onNewUserLeaderIdChange={setNewUserLeaderId}
          userItems={userItems}
          submitAssignDepartment={submitAssignDepartment}
          assignUserId={assignUserId}
          onAssignUserIdChange={setAssignUserId}
          assignDepartmentId={assignDepartmentId}
          onAssignDepartmentIdChange={setAssignDepartmentId}
          assignRoleInDept={assignRoleInDept}
          onAssignRoleInDeptChange={setAssignRoleInDept}
          assignIsPrimary={assignIsPrimary}
          onAssignIsPrimaryChange={setAssignIsPrimary}
          deptItems={deptItems}
          submitSetLeader={submitSetLeader}
          leaderUserId={leaderUserId}
          onLeaderUserIdChange={setLeaderUserId}
          leaderLeaderId={leaderLeaderId}
          onLeaderLeaderIdChange={setLeaderLeaderId}
          userKeywordInput={userKeywordInput}
          onUserKeywordInputChange={setUserKeywordInput}
          userDepartmentFilter={userDepartmentFilter}
          onUserDepartmentFilterChange={setUserDepartmentFilter}
          onSearchUser={() => {
            setUserPage(1);
            setUserKeyword(userKeywordInput);
          }}
          userTotal={userTotal}
          userPage={userPage}
          userPageSize={userPageSize}
          onPrevUserPage={() => setUserPage((value) => value - 1)}
          onNextUserPage={() => setUserPage((value) => value + 1)}
          loading={loading}
        />
      </div>
    </AppShell>
  );
}
