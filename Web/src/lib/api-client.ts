import { env } from "@/lib/env";
import { configureApiClient } from "@zynd/shared/api";

configureApiClient({ apiUrl: env.apiUrl });

export {
  ApiError,
  apiRequest,
  getAccessToken,
  getApiUrl,
  getNotificationStreamUrl,
  getSupportWebSocketUrl,
  BACKEND_HEALTH_OK_INTERVAL_MS,
  backendDownPollDelayMs,
  getBackendConnectionState,
  isAuthFailure,
  isBackendConnectionError,
  isBackendConnectionStatus,
  markBackendConnectionDown,
  markBackendConnectionReady,
  markBackendConnectionWaiting,
  parseApiError,
  refreshSession,
  setAccessToken,
  subscribeBackendConnectionState,
  type ApiErrorBody,
  type BackendConnectionState,
  type SessionRefreshResult,
} from "@zynd/shared/api";
