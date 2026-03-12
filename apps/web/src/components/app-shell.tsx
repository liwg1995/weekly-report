"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { getSessionUser, logoutWithConfirm } from "../lib/auth-session";
import {
  canAccess,
  getAllowedCapabilitiesForRoles,
  getLandingPathForRole,
  getPreferredWorkspace,
  readActiveRole,
  type Capability,
  type UserRole,
  type WorkspaceType,
  writeActiveRole
} from "../lib/authz";
import { navigateTo } from "../lib/navigation";

type NavItem = {
  label: string;
  href: string;
  capability: Capability;
};

const WORKSPACE_NAV: Record<WorkspaceType, NavItem[]> = {
  "admin-workspace": [
    { label: "组织管理", href: "/manager/org", capability: "org:read" },
    { label: "绩效配置", href: "/manager/performance", capability: "performance:read" },
    { label: "审批管理", href: "/manager/reviews", capability: "reviews:read" }
  ],
  "review-workspace": [
    { label: "审批管理", href: "/manager/reviews", capability: "reviews:read" },
    { label: "绩效占位", href: "/manager/performance", capability: "performance:read" }
  ],
  "employee-workspace": [
    { label: "我的周报", href: "/employee/feedback", capability: "feedback:read" }
  ]
};

type AppShellProps = {
  workspace?: WorkspaceType;
  pageTitle: string;
  pageDescription?: string;
  children: ReactNode;
};

export default function AppShell({ workspace, pageTitle, pageDescription, children }: AppShellProps) {
  const user = getSessionUser();
  const roles = user?.roles ?? [];
  const capabilities = getAllowedCapabilitiesForRoles(roles);
  const resolvedWorkspace = workspace ?? getPreferredWorkspace(roles);
  const activeRole = readActiveRole();
  const selectedRole =
    activeRole && roles.includes(activeRole) ? activeRole : roles[0] ?? "";
  const navItems = useMemo(
    () => WORKSPACE_NAV[resolvedWorkspace].filter((item) => canAccess(item.capability, capabilities)),
    [resolvedWorkspace, capabilities]
  );

  return (
    <div className="shell-root">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <p className="shell-brand-subtitle">Weekly Report</p>
          <h1>管理后台</h1>
        </div>
        <nav className="shell-nav" aria-label="主导航">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="shell-nav-item">
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <div>
            <div className="shell-breadcrumb">首页 / {pageTitle}</div>
            <h2>{pageTitle}</h2>
            {pageDescription ? <p>{pageDescription}</p> : null}
          </div>
          <div className="shell-header-actions">
            {roles.length > 1 ? (
              <label className="shell-role-switch">
                身份视图
                <select
                  aria-label="身份视图切换"
                  value={selectedRole}
                  onChange={(event) => {
                    const next = event.target.value as UserRole;
                    writeActiveRole(next);
                    navigateTo(getLandingPathForRole(next));
                  }}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <span className="shell-user">{user?.username ?? "未登录"}</span>
            <button type="button" className="shell-logout" onClick={() => logoutWithConfirm()}>
              退出登录
            </button>
          </div>
        </header>

        <div className="shell-global-message" role="status" aria-live="polite">
          当前工作台：{resolvedWorkspace}
        </div>

        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
