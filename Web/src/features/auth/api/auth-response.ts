import { setAccessToken } from "@/lib/api-client";
import { storeLoginSecurityAlerts } from "@/features/account/security/login-security-alerts";
import type { AuthSuccessResponse, AuthUser } from "@/features/auth/api/types";
import { storageKeys } from "@/shared/config/storage-keys";

function assertInvestorUser(user: AuthUser) {
  if (user.role === "admin") {
    throw new Error("Admin accounts must use the management console.");
  }
}

export function markSessionHint() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKeys.sessionHint, "1");
  }
}

export function clearSessionHint() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(storageKeys.sessionHint);
  }
}

export function hasSessionHint() {
  return typeof window !== "undefined" && window.localStorage.getItem(storageKeys.sessionHint) === "1";
}

export function storeAuthResponse(data: AuthSuccessResponse) {
  assertInvestorUser(data.user);
  setAccessToken(data.access_token);
  markSessionHint();
  storeLoginSecurityAlerts({
    newDevice: Boolean(data.new_device),
    velocityFlagged: Boolean(data.velocity_flagged),
  });
  return data;
}
