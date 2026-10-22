export { configureApiClient, getApiUrl } from "./configure";
export { normalizeBackendOrigin, normalizePublicApiUrl } from "./normalize-api-url";
export { getBackendDirectHttpOrigin } from "./backend-direct-origin";
export { getNotificationStreamUrl } from "./notification-stream-url";
export { getSupportWebSocketUrl } from "./support-ws-url";
export {
  connectSupportRealtime,
  type SupportRealtimeEvent,
  type SupportRealtimeHandlers,
} from "../support/realtime-client";
export {
  BACKEND_HEALTH_OK_INTERVAL_MS,
  BACKEND_WAITING_CONFIRM_MS,
  backendDownPollDelayMs,
  getBackendConnectionState,
  isBackendConnectionError,
  isBackendConnectionStatus,
  markBackendConnectionDown,
  markBackendConnectionReady,
  markBackendConnectionWaiting,
  subscribeBackendConnectionState,
  type BackendConnectionState,
} from "./connection-state";
export { ApiError, isAuthFailure, parseApiError, type ApiErrorBody } from "./errors";
export {
  apiRequest,
  getAccessToken,
  refreshSession,
  setAccessToken,
  type SessionRefreshResult,
} from "./client";
