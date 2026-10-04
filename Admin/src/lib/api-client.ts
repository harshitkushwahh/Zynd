import { env } from "@/lib/env";
import { configureApiClient } from "@zynd/shared/api";

configureApiClient({ apiUrl: env.apiUrl, clientKind: "admin" });

export {
  ApiError,
  apiRequest,
  getAccessToken,
  isAuthFailure,
  isBackendConnectionError,
  refreshSession,
  setAccessToken,
  type ApiErrorBody,
  type SessionRefreshResult,
} from "@zynd/shared/api";
