"use client";

import { FormEvent, useState } from "react";
import { ApiClientError, apiPost } from "../../lib/api-client";
import { saveSessionUser } from "../../lib/auth-session";
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
      const isManagerSide = roles.some((role) =>
        ["SUPER_ADMIN", "DEPT_ADMIN", "MANAGER"].includes(role)
      );
      navigateTo(isManagerSide ? "/manager/reviews" : "/employee/feedback");
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
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px"
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: "380px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "var(--space-6)",
          display: "grid",
          gap: "var(--space-4)"
        }}
      >
        <h1 style={{ margin: 0, fontSize: "22px" }}>员工周报系统</h1>
        <p style={{ margin: 0, color: "var(--muted)" }}>请输入账号密码登录</p>

        <label htmlFor="username">用户名</label>
        <input
          id="username"
          name="username"
          type="text"
          required
          style={{
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "10px 12px"
          }}
        />

        <label htmlFor="password">密码</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          style={{
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "10px 12px"
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "var(--space-2)",
            border: "none",
            borderRadius: "10px",
            padding: "10px 14px",
            background: loading ? "#93c5fd" : "var(--primary)",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "登录中..." : "登录"}
        </button>

        {error ? (
          <p style={{ margin: 0, color: "var(--danger)", fontSize: "14px" }}>{error}</p>
        ) : null}
        {success ? (
          <p style={{ margin: 0, color: "var(--primary-strong)", fontSize: "14px" }}>
            {success}
          </p>
        ) : null}
      </form>
    </main>
  );
}
