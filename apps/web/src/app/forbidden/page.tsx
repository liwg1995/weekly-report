"use client";

import { useMemo } from "react";
import { getSessionUser } from "../../lib/auth-session";

export default function ForbiddenPage() {
  const from = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("from") ?? "";
  }, []);

  const user = getSessionUser();

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <section style={{ maxWidth: "560px", width: "100%", border: "1px solid var(--border)", borderRadius: "14px", background: "var(--surface)", padding: "24px" }}>
        <h1 style={{ marginTop: 0 }}>403 无权限访问</h1>
        <p style={{ color: "var(--muted)" }}>
          当前账号 {user?.username ?? "未登录用户"} 无法访问此页面。
          {from ? `来源页面：${from}` : ""}
        </p>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          <a href="/">返回首页</a>
          <a href="/login">切换账号</a>
        </div>
      </section>
    </main>
  );
}
