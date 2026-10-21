import { env } from "@/lib/env";
import { configureApiClient } from "@zynd/shared/api";

configureApiClient({ apiUrl: env.apiUrl, clientKind: "admin" });

export {
  ApiError,
  apiRequest,
  getAccessToken,
  getApiUrl,
  BACKEND_HEALTH_OK_INTERVAL_MS,
  backendDownPollDelayMs,
  getBackendConnectionState,
  isAuthFailure,
  isBackendConnectionError,
  markBackendConnectionDown,
  markBackendConnectionReady,
  markBackendConnectionWaiting,
  refreshSession,
  setAccessToken,
  subscribeBackendConnectionState,
  type ApiErrorBody,
  type BackendConnectionState,
  type SessionRefreshResult,
} from "@zynd/shared/api";
