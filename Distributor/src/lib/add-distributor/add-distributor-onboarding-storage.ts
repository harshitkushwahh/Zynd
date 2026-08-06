const ONBOARDING_TOKEN_STORAGE_KEY = "zynd.distributor.partner-onboarding.token";

export function readStoredPartnerOnboardingToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(ONBOARDING_TOKEN_STORAGE_KEY);
    return value?.trim() ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredPartnerOnboardingToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!token?.trim()) {
      window.sessionStorage.removeItem(ONBOARDING_TOKEN_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(ONBOARDING_TOKEN_STORAGE_KEY, token.trim());
  } catch {
    // Ignore storage failures; wizard still works in-memory.
  }
}

export function clearStoredPartnerOnboardingToken(): void {
  writeStoredPartnerOnboardingToken(null);
}
