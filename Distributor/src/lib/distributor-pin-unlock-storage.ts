const PIN_UNLOCK_KEY = "zynd:distributor:pin-unlocked-at";
const PIN_IDLE_MS = 60 * 60 * 1000;

export function markPinUnlocked(expiresInSeconds = PIN_IDLE_MS / 1000) {
  if (typeof window === "undefined") return;
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  window.sessionStorage.setItem(PIN_UNLOCK_KEY, String(expiresAt));
}

export function clearPinUnlock() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PIN_UNLOCK_KEY);
}

export function isPinUnlockedLocally(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.sessionStorage.getItem(PIN_UNLOCK_KEY);
  if (!raw) return false;
  const expiresAt = Number(raw);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

export function touchPinUnlockActivity() {
  if (!isPinUnlockedLocally()) return;
  markPinUnlocked();
}

export function shouldRequirePinUnlock(pinEnrolled: boolean): boolean {
  if (!pinEnrolled) return false;
  return !isPinUnlockedLocally();
}
