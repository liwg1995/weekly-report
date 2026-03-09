import { navigateTo } from "./navigation";
import { getAccessToken } from "./auth-session";
export class ApiClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiClientError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type RequestOptions = {
  autoRedirect401?: boolean;
};

const buildUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  if (!base) {
    return path;
  }
  const normalizedPath = path.startsWith("/api/") ? path.slice(4) : path;
  return `${base}${normalizedPath}`;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message || `请求失败（${response.status}）`;
  } catch {
    return `请求失败（${response.status}）`;
  }
};

export async function apiGet<T>(
  path: string,
  options?: RequestOptions
): Promise<T> {
  return request<T>("GET", path, undefined, options);
}

export async function apiPost<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: RequestOptions
): Promise<TResponse> {
  return request<TResponse>("POST", path, body, options);
}

export async function apiPatch<TResponse, TBody = unknown>(
  path: string,
  body?: TBody,
  options?: RequestOptions
): Promise<TResponse> {
  return request<TResponse>("PATCH", path, body, options);
}

export async function apiDelete<TResponse = unknown>(
  path: string,
  options?: RequestOptions
): Promise<TResponse> {
  return request<TResponse>("DELETE", path, undefined, options);
}

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    if (
      response.status === 401 &&
      options?.autoRedirect401 !== false &&
      typeof window !== "undefined"
    ) {
      navigateTo("/login");
    }
    throw new ApiClientError(response.status, await parseErrorMessage(response));
  }

  return (await response.json()) as T;
}
