"use client";

import { useEffect, useState } from "react";
import { getSessionUser, requireAuth } from "./auth-session";
import { canAccessRoute, getAllowedCapabilitiesForRoles, type Capability } from "./authz";
import { navigateTo } from "./navigation";

type UseAuthGuardPolicy = {
  requiredAny?: Capability[];
  currentPath: string;
};

export type AuthGuardState = {
  ready: boolean;
  blocked: boolean;
};

export const useAuthGuard = (policy: UseAuthGuardPolicy): AuthGuardState => {
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const token = requireAuth();
    if (!token) {
      setBlocked(true);
      return;
    }

    const user = getSessionUser();
    if (!user) {
      navigateTo("/login");
      setBlocked(true);
      return;
    }

    const capabilities = getAllowedCapabilitiesForRoles(user.roles);
    const routeAllowed = canAccessRoute(policy.currentPath, capabilities);
    const policyAllowed =
      !policy.requiredAny ||
      policy.requiredAny.length === 0 ||
      policy.requiredAny.some((item) => capabilities.includes(item));

    if (!routeAllowed || !policyAllowed) {
      navigateTo(`/forbidden?from=${encodeURIComponent(policy.currentPath)}`);
      setBlocked(true);
      return;
    }

    setReady(true);
    setBlocked(false);
  }, [policy.currentPath, policy.requiredAny]);

  return { ready, blocked };
};
