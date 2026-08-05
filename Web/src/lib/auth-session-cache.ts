import type { AuthUser } from "@/features/auth/api/types";

/** Persists auth across Fast Refresh so HMR does not flash the global loader. */
type AuthSessionSnapshot = {
  user: AuthUser | null;
  sessionRetrying: boolean;
  bootstrapped: boolean;
};

let authSessionSnapshot: AuthSessionSnapshot | null = null;

export function readAuthSessionSnapshot() {
  return authSessionSnapshot;
}

export function writeAuthSessionSnapshot(snapshot: AuthSessionSnapshot) {
  authSessionSnapshot = snapshot;
}

export function clearAuthSessionSnapshot() {
  authSessionSnapshot = null;
}
