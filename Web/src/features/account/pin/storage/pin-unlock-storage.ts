import { appConfig } from "@/shared/config/app-config";
import { storageKeys } from "@/shared/config/storage-keys";

export function markPinUnlocked(expiresInSeconds = appConfig.pinIdleTimeoutMs / 1000) {
  if (typeof window === "undefined") return;
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  window.sessionStorage.setItem(storageKeys.pinUnlockedAt, String(expiresAt));
}

export function clearPinUnlock() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(storageKeys.pinUnlockedAt);
}

export function isPinUnlockedLocally(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.sessionStorage.getItem(storageKeys.pinUnlockedAt);
  if (!raw) return false;
  const expiresAt = Number(raw);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}

export function touchPinUnlockActivity() {
  if (typeof window === "undefined") return;
  if (!isPinUnlockedLocally()) return;
  markPinUnlocked();
}

export function shouldRequirePinUnlock(pinEnrolled: boolean): boolean {
  if (!pinEnrolled) return false;
  return !isPinUnlockedLocally();
}
