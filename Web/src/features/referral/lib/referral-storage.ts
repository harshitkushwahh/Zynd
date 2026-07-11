import { storageKeys } from "@/shared/config/storage-keys";

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{6,16}$/;

export function normalizeReferralCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function persistReferralCode(value: string): void {
  const normalized = normalizeReferralCode(value);
  if (!normalized || typeof window === "undefined") return;
  window.localStorage.setItem(storageKeys.referralCode, normalized);
}

export function readReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return normalizeReferralCode(window.localStorage.getItem(storageKeys.referralCode));
}

export function clearReferralCode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKeys.referralCode);
}

export function buildReferralShareUrl(code: string, origin?: string): string {
  const base = (origin ?? (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
  return `${base}/r/${code}`;
}
