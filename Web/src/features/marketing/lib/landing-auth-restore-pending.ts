import { hasSessionHint } from "@/features/auth/api/auth-response";
import type { AuthUser } from "@/features/auth/api/types";

type LandingAuthRestoreInput = {
  user: AuthUser | null;
  loading: boolean;
  sessionRestoring: boolean;
  sessionRetrying: boolean;
};

/** Marketing nav should not flash Get Started while session restore may still succeed. */
export function isLandingAuthRestorePending({
  user,
  loading,
  sessionRestoring,
  sessionRetrying,
}: LandingAuthRestoreInput): boolean {
  if (user) return false;
  return loading || sessionRestoring || sessionRetrying || hasSessionHint();
}
