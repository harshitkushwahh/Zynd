export type ApiErrorBody = {
  code?: string;
  message?: string;
  captcha_required?: boolean;
  retry_after_seconds?: number;
};

export class ApiError extends Error {
  code: string;
  status: number;
  captchaRequired?: boolean;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    code = "api_error",
    status = 400,
    captchaRequired?: boolean,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.captchaRequired = captchaRequired;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isAuthFailure(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 401 ||
      error.status === 403 ||
      error.code === "session_expired" ||
      error.code === "unauthorized")
  );
}

export async function parseApiError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    const detail = body.detail as ApiErrorBody | ApiErrorBody[] | string | undefined;
    if (typeof detail === "string") {
      return new ApiError(detail, "api_error", response.status);
    }
    if (Array.isArray(detail) && detail[0]?.message) {
      return new ApiError(detail[0].message, detail[0].code ?? "api_error", response.status);
    }
    if (detail && typeof detail === "object" && "message" in detail) {
      return new ApiError(
        detail.message ?? "Request failed",
        detail.code ?? "api_error",
        response.status,
        "captcha_required" in detail ? Boolean(detail.captcha_required) : undefined,
        "retry_after_seconds" in detail ? Number(detail.retry_after_seconds) : undefined
      );
    }
  } catch {
    // ignore parse errors
  }
  return new ApiError("Request failed", "api_error", response.status);
}
