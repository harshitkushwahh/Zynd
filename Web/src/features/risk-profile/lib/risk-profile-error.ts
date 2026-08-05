import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";

export function getRiskProfileErrorMessage(
  error: unknown,
  fallback = copy.riskProfile.errors.loadFailed,
): string {
  if (error instanceof ApiError) {
    if (error.code === "risk_profile_locked") {
      return copy.riskProfile.errors.locked;
    }
    if (error.status >= 500) {
      return fallback;
    }
    if (error.message && error.message !== "Request failed") {
      return error.message;
    }
  }

  if (error instanceof Error && error.message && error.message !== "Request failed") {
    return error.message;
  }

  return fallback;
}
