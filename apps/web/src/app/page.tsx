"use client";

import { useEffect } from "react";
import { getAccessToken, getSessionUser } from "../lib/auth-session";
import { navigateTo } from "../lib/navigation";

export default function HomePage() {
  useEffect(() => {
    const token = getAccessToken();
    const sessionUser = getSessionUser();
    if (!token || !sessionUser) {
      navigateTo("/login");
      return;
    }

    const isOrgAdmin = sessionUser.roles.some((role) =>
      ["SUPER_ADMIN", "DEPT_ADMIN"].includes(role)
    );
    if (isOrgAdmin) {
      navigateTo("/manager/org");
      return;
    }
    const isManager = sessionUser.roles.includes("MANAGER");
    navigateTo(isManager ? "/manager/reviews" : "/employee/feedback");
  }, []);

  return <main style={{ padding: "24px" }}>跳转中...</main>;
}
