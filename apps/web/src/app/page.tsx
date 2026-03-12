"use client";

import { useEffect } from "react";
import { getAccessToken, getSessionUser } from "../lib/auth-session";
import { getLandingPathForWorkspace, getPreferredWorkspace } from "../lib/authz";
import { navigateTo } from "../lib/navigation";

export default function HomePage() {
  useEffect(() => {
    const token = getAccessToken();
    const sessionUser = getSessionUser();
    if (!token || !sessionUser) {
      navigateTo("/login");
      return;
    }

    const workspace = getPreferredWorkspace(sessionUser.roles);
    navigateTo(getLandingPathForWorkspace(workspace));
  }, []);

  return <main style={{ padding: "24px" }}>跳转中...</main>;
}
