import { storageKeys } from "@/shared/config/storage-keys";

const FAMILY_INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

export function normalizeFamilyInviteToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return FAMILY_INVITE_TOKEN_PATTERN.test(normalized) ? normalized : null;
}

export function persistFamilyInviteToken(value: string): void {
  const normalized = normalizeFamilyInviteToken(value);
  if (!normalized || typeof window === "undefined") return;
  window.localStorage.setItem(storageKeys.familyInviteToken, normalized);
}

export function readFamilyInviteToken(): string | null {
  if (typeof window === "undefined") return null;
  return normalizeFamilyInviteToken(window.localStorage.getItem(storageKeys.familyInviteToken));
}

export function clearFamilyInviteToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKeys.familyInviteToken);
}

export function buildFamilyInviteShareUrl(token: string, origin?: string): string {
  const base = (origin ?? (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  return `${base}/g/${token}`;
}

export function extractFamilyInviteTokenFromShareUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const match = url.pathname.match(/\/g\/([^/]+)$/);
    return normalizeFamilyInviteToken(match?.[1] ?? null);
  } catch {
    return normalizeFamilyInviteToken(value);
  }
}
