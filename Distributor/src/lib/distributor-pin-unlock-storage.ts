const PIN_UNLOCK_KEY_PREFIX = "zynd:distributor:pin-unlocked-at";
const PIN_IDLE_MS = 60 * 60 * 1000;

function pinUnlockKey(userId: string) {
  return `${PIN_UNLOCK_KEY_PREFIX}:${userId}`;
}

function readExpiry(userId: string): number | null {
  if (typeof window === "undefined" || !userId) return null;

  const storages = [window.localStorage, window.sessionStorage];
  for (const storage of storages) {
    const raw = storage.getItem(pinUnlockKey(userId));
    if (!raw) continue;
    const expiresAt = Number(raw);
    if (Number.isFinite(expiresAt)) {
      return expiresAt;
    }
  }

  return null;
}

function writeExpiry(userId: string, expiresAt: number) {
  if (typeof window === "undefined" || !userId) return;
  const value = String(expiresAt);
  window.localStorage.setItem(pinUnlockKey(userId), value);
  window.sessionStorage.setItem(pinUnlockKey(userId), value);
}

function removeExpiry(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.removeItem(pinUnlockKey(userId));
  window.sessionStorage.removeItem(pinUnlockKey(userId));
}

export function markPinUnlocked(userId: string, expiresInSeconds = PIN_IDLE_MS / 1000) {
  if (typeof window === "undefined" || !userId) return;
  writeExpiry(userId, Date.now() + expiresInSeconds * 1000);
}

export function clearPinUnlock(userId?: string) {
  if (typeof window === "undefined") return;
  if (userId) {
    removeExpiry(userId);
    return;
  }

  const keysToRemove: string[] = [];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(`${PIN_UNLOCK_KEY_PREFIX}:`)) {
        keysToRemove.push(key);
      }
    }
  }
  keysToRemove.forEach((key) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  });
}

export function isPinUnlockedLocally(userId?: string | null): boolean {
  if (!userId) return false;
  const expiresAt = readExpiry(userId);
  return expiresAt !== null && Date.now() < expiresAt;
}

export function touchPinUnlockActivity(userId: string) {
  if (!isPinUnlockedLocally(userId)) return;
  markPinUnlocked(userId);
}

export function shouldRequirePinUnlock(pinEnrolled: boolean, userId?: string | null): boolean {
  if (!pinEnrolled || !userId) return false;
  return !isPinUnlockedLocally(userId);
}
