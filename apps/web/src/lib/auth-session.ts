import { navigateTo } from "./navigation";

type SessionUser = {
  username: string;
  roles: string[];
};

export const getAccessToken = () => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem("accessToken") ?? "";
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(padded);
  }
  return "";
};

export const getTokenExpiryEpoch = (token: string): number | null => {
  if (!token) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
};

export const getTokenRemainingSeconds = (token: string): number | null => {
  const exp = getTokenExpiryEpoch(token);
  if (!exp) {
    return null;
  }
  return exp - Math.floor(Date.now() / 1000);
};

export const getSessionUser = (): SessionUser | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem("sessionUser");
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SessionUser;
    if (!Array.isArray(parsed.roles)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveSessionUser = (user: SessionUser) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem("sessionUser", JSON.stringify(user));
};

export const requireAuth = () => {
  const token = getAccessToken();
  if (!token) {
    navigateTo("/login");
    return "";
  }
  const remaining = getTokenRemainingSeconds(token);
  if (remaining !== null && remaining <= 0) {
    logout();
    return "";
  }
  return token;
};

export const requireRole = (allowedRoles: string[], fallback = "/login") => {
  const token = requireAuth();
  if (!token) {
    return false;
  }
  const user = getSessionUser();
  if (!user) {
    navigateTo(fallback);
    return false;
  }
  const matched = user.roles.some((role) => allowedRoles.includes(role));
  if (!matched) {
    navigateTo(fallback);
    return false;
  }
  return true;
};

export const logout = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("sessionUser");
  navigateTo("/login");
};

export const logoutWithConfirm = (
  message = "确定退出登录吗？未保存内容可能丢失。"
) => {
  if (typeof window === "undefined") {
    return;
  }
  const confirmed = window.confirm(message);
  if (!confirmed) {
    return;
  }
  logout();
};
