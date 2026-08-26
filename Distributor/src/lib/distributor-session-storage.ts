import type { DistributorSessionUser } from "@/lib/distributor-session-types";

export const DISTRIBUTOR_SESSION_STORAGE_KEY = "zynd-distributor-session";

export function readPersistedDistributorSession(): DistributorSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DISTRIBUTOR_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DistributorSessionUser;
  } catch {
    return null;
  }
}

export function persistDistributorSession(user: DistributorSessionUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISTRIBUTOR_SESSION_STORAGE_KEY, JSON.stringify(user));
}

export function clearPersistedDistributorSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DISTRIBUTOR_SESSION_STORAGE_KEY);
}
