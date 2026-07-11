import { ApiError } from "@/lib/api-client";

export function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function syncOtpCooldownFromError(
  error: unknown,
  syncFromError: (retryAfterSeconds?: number) => void
) {
  if (error instanceof ApiError) {
    syncFromError(error.retryAfterSeconds);
  }
}
