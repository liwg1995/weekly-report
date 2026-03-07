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

    const managerRoles = ["SUPER_ADMIN", "DEPT_ADMIN", "MANAGER"];
    const isManagerSide = sessionUser.roles.some((role) =>
      managerRoles.includes(role)
    );
    navigateTo(isManagerSide ? "/manager/reviews" : "/employee/feedback");
  }, []);

  return <main style={{ padding: "24px" }}>跳转中...</main>;
}
