import type { AuthUser } from "@/features/auth/api/types";
import { hasSessionHint, clearSessionHint } from "@/features/auth/api/auth-response";
import { storageKeys } from "@/shared/config/storage-keys";

export function readPersistedAuthUser(): AuthUser | null {
  if (typeof window === "undefined" || !hasSessionHint()) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(storageKeys.sessionUser);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedAuthUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    window.sessionStorage.removeItem(storageKeys.sessionUser);
    return;
  }
  try {
    window.sessionStorage.setItem(storageKeys.sessionUser, JSON.stringify(user));
  } catch {
    // Quota or private mode  ignore.
  }
}

export function clearPersistedAuthSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(storageKeys.sessionUser);
  clearSessionHint();
}

/** True when UI should treat the visitor as likely logged in (restore in progress). */
export function shouldHoldAuthRestoreUi(user: AuthUser | null): boolean {
  return !user && hasSessionHint();
}
