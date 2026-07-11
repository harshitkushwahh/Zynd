import { storageKeys } from "@/shared/config/storage-keys";

function storageKey(userId: string) {
  return `${storageKeys.pinBiometricCredentialPrefix}${userId}`;
}

export function getLocalPinBiometricCredentialId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey(userId));
}

export function saveLocalPinBiometricCredentialId(userId: string, credentialId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), credentialId);
}

export function clearLocalPinBiometricCredentialId(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(userId));
}

export function hasLocalPinBiometricCredential(userId: string, credentialId?: string | null) {
  const stored = getLocalPinBiometricCredentialId(userId);
  if (!stored) return false;
  if (credentialId) return stored === credentialId;
  return true;
}
