import { ApiError } from "@/lib/api-client";

function isNotFoundLikeError(error: ApiError) {
  return (
    error.status === 404 ||
    error.message === "Not Found" ||
    error.message === "Request failed"
  );
}

export function isIgnorableListLoadError(error: unknown) {
  return error instanceof ApiError && isNotFoundLikeError(error);
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (isNotFoundLikeError(error)) {
      return fallback;
    }
    return error.message;
  }
  if (error instanceof Error) {
    if (error.message === "Not Found" || error.message === "Request failed") {
      return fallback;
    }
    return error.message;
  }
  return fallback;
}
