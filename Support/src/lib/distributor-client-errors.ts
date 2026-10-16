import { ApiError } from "@/lib/api-client";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";

export function isClientNotFoundError(error: unknown) {
  if (error instanceof ApiError) {
    return error.code === "client_not_found";
  }
  return (
    error instanceof Error &&
    (error as Error & { code?: string }).code === "client_not_found"
  );
}

/** FastAPI plain `Not Found` when the support console user API is not on the running backend. */
export function isSupportUserDirectoryUnavailable(error: unknown) {
  return error instanceof ApiError && error.status === 404 && error.code === "api_error";
}

export function getClientDetailErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (isSupportUserDirectoryUnavailable(error)) {
      return "User profile API is unavailable. Restart Backend (Backend/run.sh) and reload this page.";
    }
    if (isClientNotFoundError(error)) {
      return DISTRIBUTOR_CLIENT_COPY.clientNotFound;
    }
    if (error.code === "client_not_in_book") {
      return DISTRIBUTOR_CLIENT_COPY.clientNotInBook;
    }
    if (error.message && error.message !== "Request failed") {
      return error.message;
    }
  }
  return DISTRIBUTOR_CLIENT_COPY.clientDetailLoadFailed;
}
