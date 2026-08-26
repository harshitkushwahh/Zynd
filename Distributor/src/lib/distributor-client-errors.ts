import { ApiError } from "@/lib/api-client";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";

export function isClientNotFoundError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 404 || error.code === "client_not_found")
  );
}

export function getClientDetailErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
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
