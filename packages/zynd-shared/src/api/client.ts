import { getApiUrl } from "./configure";
import { ApiError, parseApiError } from "./errors";

let accessToken: string | null = null;
let refreshPromise: Promise<SessionRefreshResult> | null = null;

const AUTH_PATHS_SKIP_SESSION_REFRESH = [
  "/auth/signup/",
  "/auth/login",
  "/auth/password/forgot",
  "/auth/password/reset",
  "/auth/oauth/",
] as const;

function shouldRefreshSessionOn401(path: string): boolean {
  if (path === "/auth/refresh") {
    return false;
  }

  return !AUTH_PATHS_SKIP_SESSION_REFRESH.some((prefix) => path.startsWith(prefix));
}

export type SessionRefreshResult =
  | { ok: true; accessToken: string; data: Record<string, unknown> }
  | { ok: false; reason: "expired" | "network" };

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export async function refreshSession(): Promise<SessionRefreshResult> {
  if (!refreshPromise) {
    refreshPromise = (async (): Promise<SessionRefreshResult> => {
      try {
        const response = await fetch(`${getApiUrl()}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          setAccessToken(null);
          return { ok: false, reason: "expired" };
        }

        const data = (await response.json()) as Record<string, unknown> & {
          access_token: string;
        };
        setAccessToken(data.access_token);
        return { ok: true, accessToken: data.access_token, data };
      } catch {
        return { ok: false, reason: "network" };
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function refreshAccessToken(): Promise<string | null> {
  const result = await refreshSession();
  return result.ok ? result.accessToken : null;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers,
    credentials: "include",
  }).catch((error: unknown) => {
    if (error instanceof TypeError) {
      throw new ApiError("Unable to reach the server. Try again shortly.", "network_error", 503);
    }
    throw error;
  });

  if (response.status === 401 && retry && shouldRefreshSessionOn401(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest<T>(path, options, false);
    }
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
