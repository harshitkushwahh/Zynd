export { configureApiClient, getApiUrl } from "./configure";
export { getSupportWebSocketUrl } from "./support-ws-url";
export {
  connectSupportRealtime,
  type SupportRealtimeEvent,
  type SupportRealtimeHandlers,
} from "../support/realtime-client";
export {
  BACKEND_WAITING_CONFIRM_MS,
  getBackendConnectionState,
  isBackendConnectionError,
  isBackendConnectionStatus,
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
