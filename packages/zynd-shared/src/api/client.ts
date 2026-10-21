import {
  backendDownPollDelayMs,
  beginBackendRequest,
  endBackendRequest,
  isBackendConnectionError,
  isBackendConnectionStatus,
  markBackendConnectionReady,
  markBackendConnectionWaiting,
} from "./connection-state";
import { getApiUrl, getClientKind } from "./configure";
import { ApiError, parseApiError } from "./errors";

let accessToken: string | null = null;
let refreshPromise: Promise<SessionRefreshResult> | null = null;
let refreshCooldownUntil = 0;
let refreshFailureCount = 0;
let refreshCooldownReason: "network" | "expired" = "network";

function cooledRefreshResult(): SessionRefreshResult | null {
  if (Date.now() >= refreshCooldownUntil) return null;
  return { ok: false, reason: refreshCooldownReason };
}

function startRefreshCooldown(reason: "network" | "expired"): void {
  refreshCooldownReason = reason;
  if (reason === "expired") {
    refreshCooldownUntil = Date.now() + 60_000;
    return;
  }
  refreshFailureCount += 1;
  refreshCooldownUntil = Date.now() + backendDownPollDelayMs(refreshFailureCount);
}

function clearRefreshCooldown(): void {
  refreshFailureCount = 0;
  refreshCooldownUntil = 0;
}

const AUTH_PATHS_SKIP_SESSION_REFRESH = [
  "/auth/signup/",
  "/auth/login",
  "/auth/password/forgot",
  "/auth/password/reset",
  "/auth/oauth/",
  "/auth/pin/",
] as const;

const SESSION_REFRESH_ERROR_CODES = new Set([
  "session_expired",
  "session_compromised",
  "unauthorized",
]);

function applyClientHeaders(headers: Headers) {
  if (headers.has("X-Zynd-Client")) {
    return;
  }
  const kind = getClientKind();
  if (kind === "admin") {
    headers.set("X-Zynd-Client", "admin");
  } else if (kind === "distributor") {
    headers.set("X-Zynd-Client", "distributor");
  } else if (kind === "support") {
    headers.set("X-Zynd-Client", "support");
  }
}

function shouldRefreshSessionOn401(path: string): boolean {
  if (path === "/auth/refresh") {
    return false;
  }

  return !AUTH_PATHS_SKIP_SESSION_REFRESH.some((prefix) => path.startsWith(prefix));
}

function shouldRetryAfterSessionRefresh(error: ApiError): boolean {
  return SESSION_REFRESH_ERROR_CODES.has(error.code);
}

export type SessionRefreshResult =
  | { ok: true; accessToken: string; data: Record<string, unknown> }
  | { ok: false; reason: "expired" | "network" };

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) clearRefreshCooldown();
}

export function getAccessToken() {
  return accessToken;
}

export async function refreshSession(): Promise<SessionRefreshResult> {
  const cooled = cooledRefreshResult();
  if (cooled) return cooled;

  if (!refreshPromise) {
    refreshPromise = (async (): Promise<SessionRefreshResult> => {
      beginBackendRequest();
      try {
        const headers = new Headers();
        applyClientHeaders(headers);
        const response = await fetch(`${getApiUrl()}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers,
        }).catch((error: unknown) => {
          markBackendConnectionWaiting();
          throw error;
        });

        if (!response.ok) {
          if (isBackendConnectionStatus(response.status)) {
            markBackendConnectionWaiting();
            startRefreshCooldown("network");
            return { ok: false, reason: "network" };
          }
          const apiError = await parseApiError(response);
          const sessionEnded =
            response.status === 401 &&
            SESSION_REFRESH_ERROR_CODES.has(apiError.code);
          if (sessionEnded) {
            setAccessToken(null);
            startRefreshCooldown("expired");
            return { ok: false, reason: "expired" };
          }
          markBackendConnectionWaiting();
          startRefreshCooldown("network");
          return { ok: false, reason: "network" };
        }

        clearRefreshCooldown();
        markBackendConnectionReady();
        const data = (await response.json()) as Record<string, unknown> & {
          access_token: string;
        };
        setAccessToken(data.access_token);
        return { ok: true, accessToken: data.access_token, data };
      } catch {
        markBackendConnectionWaiting();
        startRefreshCooldown("network");
        return { ok: false, reason: "network" };
      } finally {
        endBackendRequest();
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
  beginBackendRequest();
  try {
    if (!accessToken && shouldRefreshSessionOn401(path)) {
      await refreshAccessToken();
    }

    const headers = new Headers(options.headers);
    applyClientHeaders(headers);
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
      markBackendConnectionWaiting();
      if (error instanceof TypeError) {
        throw new ApiError("Unable to reach the server. Try again shortly.", "network_error", 503);
      }
      throw error;
    });

    if (response.status === 401 && retry && shouldRefreshSessionOn401(path)) {
      const authError = await parseApiError(response.clone());
      if (shouldRetryAfterSessionRefresh(authError)) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          return apiRequest<T>(path, options, false);
        }
      }
      throw authError;
    }

    if (!response.ok) {
      if (isBackendConnectionStatus(response.status)) {
        markBackendConnectionWaiting();
      }
      throw await parseApiError(response);
    }

    markBackendConnectionReady();

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (isBackendConnectionError(error)) {
      markBackendConnectionWaiting();
    }
    throw error;
  } finally {
    endBackendRequest();
  }
}
