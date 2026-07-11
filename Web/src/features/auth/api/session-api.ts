import { apiRequest, getAccessToken, refreshSession, setAccessToken } from "@/lib/api-client";
import { appConfig } from "@/shared/config/app-config";
import {
  clearSessionHint,
  hasSessionHint,
  storeAuthResponse,
} from "@/features/auth/api/auth-response";
import { clearPinUnlock } from "@/features/account/pin/storage/pin-unlock-storage";
import { getDisplayName as formatDisplayName } from "@/shared/utils/user-display";
import type { AuthSuccessResponse, AuthUser } from "@/features/auth/api/types";

export async function fetchCurrentUser() {
  return apiRequest<AuthUser>("/auth/me");
}

export async function logout() {
  await apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
  setAccessToken(null);
  clearSessionHint();
  clearPinUnlock();
}

export async function bootstrapSession(): Promise<{
  user: AuthUser | null;
  reason?: "expired" | "network";
}> {
  if (!getAccessToken() && !hasSessionHint()) {
    return { user: null, reason: "expired" };
  }

  for (let attempt = 0; attempt < appConfig.bootstrapRetryAttempts; attempt += 1) {
    const refreshed = await refreshSession();
    if (refreshed.ok) {
      const data = refreshed.data as AuthSuccessResponse;
      storeAuthResponse(data);
      return { user: data.user };
    }

    if (refreshed.reason === "expired") {
      setAccessToken(null);
      return { user: null, reason: "expired" };
    }

    await new Promise((resolve) =>
      window.setTimeout(resolve, appConfig.bootstrapRetryBaseDelayMs * (attempt + 1))
    );
  }

  return { user: null, reason: "network" };
}

export function getDisplayName(user: AuthUser) {
  return formatDisplayName(user);
}
