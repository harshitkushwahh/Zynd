import { storageKeys } from "@/shared/config/storage-keys";

function pinnedKey(userId: string) {
  return `${storageKeys.familyGroupPinnedPrefix}${userId}`;
}

export function readPinnedFamilyGroupId(userId: string | null | undefined): string | null {
  if (!userId || typeof window === "undefined") return null;
  const value = window.localStorage.getItem(pinnedKey(userId))?.trim();
  return value || null;
}

export function writePinnedFamilyGroupId(userId: string, groupId: string | null) {
  if (typeof window === "undefined") return;
  if (!groupId) {
    window.localStorage.removeItem(pinnedKey(userId));
    return;
  }
  window.localStorage.setItem(pinnedKey(userId), groupId);
}
