export type UserRole = "SUPER_ADMIN" | "DEPT_ADMIN" | "MANAGER" | "LEADER" | "EMPLOYEE";

export type WorkspaceType =
  | "admin-workspace"
  | "review-workspace"
  | "employee-workspace";

export type Capability =
  | "org:read"
  | "org:write"
  | "reviews:read"
  | "reviews:write"
  | "feedback:read"
  | "feedback:write"
  | "performance:read"
  | "performance:write";

export type RoleCapabilityMatrix = Record<UserRole, Capability[]>;

export type RouteAccessPolicy = {
  pathPrefix: string;
  requiredAny?: Capability[];
};

export const ROLE_CAPABILITY_MATRIX: RoleCapabilityMatrix = {
  SUPER_ADMIN: [
    "org:read",
    "org:write",
    "reviews:read",
    "reviews:write",
    "feedback:read",
    "feedback:write",
    "performance:read",
    "performance:write"
  ],
  DEPT_ADMIN: ["org:read", "org:write", "performance:read", "performance:write"],
  MANAGER: ["reviews:read", "reviews:write", "performance:read"],
  LEADER: ["reviews:read", "reviews:write"],
  EMPLOYEE: ["feedback:read", "feedback:write"]
};

export const ROUTE_ACCESS_POLICIES: RouteAccessPolicy[] = [
  { pathPrefix: "/manager/org", requiredAny: ["org:read"] },
  { pathPrefix: "/manager/reviews", requiredAny: ["reviews:read"] },
  { pathPrefix: "/manager/performance", requiredAny: ["performance:read"] },
  { pathPrefix: "/employee/feedback", requiredAny: ["feedback:read"] }
];

const unique = <T,>(input: T[]): T[] => [...new Set(input)];

export const normalizeRoles = (roles: string[]): UserRole[] => {
  const known = roles.filter((role): role is UserRole => role in ROLE_CAPABILITY_MATRIX);
  return unique(known);
};

export const getCapabilitiesForRoles = (roles: string[]): Capability[] => {
  const normalized = normalizeRoles(roles);
  const caps = normalized.flatMap((role) => ROLE_CAPABILITY_MATRIX[role]);
  return unique(caps);
};

export const canAccess = (capability: Capability, capabilities: Capability[]) => {
  return capabilities.includes(capability);
};

export const canAccessRoute = (path: string, capabilities: Capability[]): boolean => {
  const normalized = path.split("?")[0] ?? path;
  const policy = ROUTE_ACCESS_POLICIES.find((item) => normalized.startsWith(item.pathPrefix));
  if (!policy || !policy.requiredAny || policy.requiredAny.length === 0) {
    return true;
  }
  return policy.requiredAny.some((item) => capabilities.includes(item));
};

export const getDefaultWorkspace = (roles: string[]): WorkspaceType => {
  const normalized = normalizeRoles(roles);
  if (normalized.some((role) => role === "SUPER_ADMIN" || role === "DEPT_ADMIN")) {
    return "admin-workspace";
  }
  if (normalized.some((role) => role === "MANAGER" || role === "LEADER")) {
    return "review-workspace";
  }
  return "employee-workspace";
};

export const getWorkspaceByRole = (role: UserRole): WorkspaceType => {
  if (role === "SUPER_ADMIN" || role === "DEPT_ADMIN") {
    return "admin-workspace";
  }
  if (role === "MANAGER" || role === "LEADER") {
    return "review-workspace";
  }
  return "employee-workspace";
};

export const getLandingPathForWorkspace = (workspace: WorkspaceType): string => {
  if (workspace === "admin-workspace") {
    return "/manager/org";
  }
  if (workspace === "review-workspace") {
    return "/manager/reviews";
  }
  return "/employee/feedback";
};

export const getLandingPathForRole = (role: UserRole): string => {
  return getLandingPathForWorkspace(getWorkspaceByRole(role));
};

export const SESSION_ACTIVE_ROLE_KEY = "activeRole";

export const readActiveRole = (): UserRole | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(SESSION_ACTIVE_ROLE_KEY);
  if (!raw) {
    return null;
  }
  return raw in ROLE_CAPABILITY_MATRIX ? (raw as UserRole) : null;
};

export const writeActiveRole = (role: UserRole) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SESSION_ACTIVE_ROLE_KEY, role);
};

export const getPreferredWorkspace = (roles: string[]): WorkspaceType => {
  const normalized = normalizeRoles(roles);
  if (normalized.length === 0) {
    return "employee-workspace";
  }
  const activeRole = readActiveRole();
  if (activeRole && normalized.includes(activeRole)) {
    return getWorkspaceByRole(activeRole);
  }
  const fallback = normalized[0];
  writeActiveRole(fallback);
  return getWorkspaceByRole(fallback);
};

export const getAllowedCapabilitiesForRoles = (roles: string[]): Capability[] => {
  const normalized = normalizeRoles(roles);
  const caps = normalized.flatMap((role) => ROLE_CAPABILITY_MATRIX[role]);
  return unique(caps);
};
