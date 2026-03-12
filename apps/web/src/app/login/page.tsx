"use client";

import { FormEvent, useState } from "react";
import { ApiClientError, apiPost } from "../../lib/api-client";
import { saveSessionUser } from "../../lib/auth-session";
import {
  getLandingPathForWorkspace,
  getPreferredWorkspace
} from "../../lib/authz";
import { navigateTo } from "../../lib/navigation";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const res = await apiPost<{
        accessToken: string;
        user: { username: string; roles: string[] };
      }>("/api/auth/login", { username, password }, { autoRedirect401: false });
      window.localStorage.setItem("accessToken", res.accessToken);
      saveSessionUser({ username: res.user.username, roles: res.user.roles ?? [] });
      setSuccess("登录成功");
      const roles = res.user.roles ?? [];
      const workspace = getPreferredWorkspace(roles);
      navigateTo(getLandingPathForWorkspace(workspace));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError("用户名或密码错误");
      } else if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("网络异常，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", padding: "24px", display: "grid", placeItems: "center" }}>
      <section className="login-layout">
        <aside className="login-brand-panel">
          <div>
            <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.08em", color: "#9db4d7" }}>
              WEEKLY REPORT PLATFORM
            </p>
            <h1 style={{ margin: "8px 0 10px", fontSize: "30px", lineHeight: 1.2 }}>
              员工周报管理系统
            </h1>
            <p style={{ margin: 0, color: "#c8d8f0", lineHeight: 1.65 }}>
              面向超级管理员、部门管理员、直属领导与员工的一体化周报协同平台。
              支持周报提交、审批建议、组织维护与绩效配置。
            </p>
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", color: "#c8d8f0", lineHeight: 1.8 }}>
            <li>提升提交率与审批时效</li>
            <li>按角色进入对应工作台</li>
            <li>配置化支持后续企业IM提醒</li>
          </ul>
        </aside>

        <form onSubmit={onSubmit} className="login-form-panel">
          <h2 style={{ margin: 0, fontSize: "24px" }}>登录账号</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>请输入账号密码登录</p>

          <label htmlFor="username">用户名</label>
          <input id="username" name="username" type="text" required />

          <label htmlFor="password">密码</label>
          <input id="password" name="password" type="password" required />

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "4px",
              borderRadius: "10px",
              padding: "10px 14px",
              background: loading ? "#7f95b1" : "var(--primary)",
              color: "#fff",
              borderColor: loading ? "#7f95b1" : "var(--primary)"
            }}
          >
            {loading ? "登录中..." : "登录"}
          </button>

          {error ? (
            <p style={{ margin: 0, color: "var(--danger)", fontSize: "14px" }}>{error}</p>
          ) : null}
          {success ? (
            <p style={{ margin: 0, color: "var(--success)", fontSize: "14px" }}>{success}</p>
          ) : null}

          <div
            style={{
              marginTop: "8px",
              padding: "10px 12px",
              border: "1px dashed var(--border)",
              borderRadius: "10px",
              color: "var(--muted)",
              fontSize: "12px"
            }}
          >
            系统将根据你的角色自动进入对应工作台；多角色账号可在登录后切换身份视图。
          </div>
        </form>
      </section>
    </main>
  );
}
