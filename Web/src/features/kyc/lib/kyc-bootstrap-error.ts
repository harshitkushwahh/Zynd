import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";

export function getKycBootstrapErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return copy.kyc.bootstrapErrorServer;
    }
    if (error.status === 401 || error.status === 403 || error.code === "session_expired") {
      return copy.kyc.bootstrapErrorAuth;
    }
    if (error.message && error.message !== "Request failed") {
      return error.message;
    }
  }

  if (error instanceof Error && error.message && error.message !== "Request failed") {
    return error.message;
  }

  return copy.kyc.bootstrapErrorDescription;
}
