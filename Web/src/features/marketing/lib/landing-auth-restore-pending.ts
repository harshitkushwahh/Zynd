import type { AuthUser } from "@/features/auth/api/types";

type LandingAuthRestoreInput = {
  user: AuthUser | null;
  loading: boolean;
  sessionRestoring: boolean;
  sessionRetrying: boolean;
};

/** Marketing nav: hold skeleton until bootstrap finishes (avoids cached-user / Get Started flicker). */
export function isLandingAuthRestorePending({
  loading,
  sessionRestoring,
  sessionRetrying,
}: LandingAuthRestoreInput): boolean {
  return loading || sessionRestoring || sessionRetrying;
}
