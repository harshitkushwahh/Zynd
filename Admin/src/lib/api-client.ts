import { env } from "@/lib/env";
import { configureApiClient } from "@zynd/shared/api";

configureApiClient({ apiUrl: env.apiUrl, clientKind: "admin" });

export {
  ApiError,
  apiRequest,
  getAccessToken,
  getApiUrl,
  getBackendConnectionState,
  isAuthFailure,
  isBackendConnectionError,
  markBackendConnectionReady,
  markBackendConnectionWaiting,
  refreshSession,
  setAccessToken,
  subscribeBackendConnectionState,
  type ApiErrorBody,
  type BackendConnectionState,
  type SessionRefreshResult,
} from "@zynd/shared/api";
