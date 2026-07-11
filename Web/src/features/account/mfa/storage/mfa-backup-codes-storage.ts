import { mfaBackupCodesKey, storageKeys } from "@/shared/config/storage-keys";

export function saveMfaBackupCodes(userId: string, codes: string[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(mfaBackupCodesKey(userId), JSON.stringify(codes));
}

export function loadMfaBackupCodes(userId: string): string[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(mfaBackupCodesKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((code) => typeof code === "string") : [];
  } catch {
    return [];
  }
}

export function clearMfaBackupCodes(userId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(mfaBackupCodesKey(userId));
}

/** @deprecated Use storageKeys.mfaBackupCodesPrefix */
export const STORAGE_PREFIX = storageKeys.mfaBackupCodesPrefix;
