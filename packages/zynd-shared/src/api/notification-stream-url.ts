import { getBackendDirectHttpOrigin } from "./backend-direct-origin";
import { getApiUrl } from "./configure";

/**
 * Notification SSE must hit FastAPI directly. Proxying via Vercel `/api/v1` hits
 * the ~300s function timeout and drops the stream (see Vercel runtime timeout logs).
 */
export function getNotificationStreamUrl(): string {
  const apiBase = getApiUrl().replace(/\/$/, "");
  const streamPath = "/notifications/stream";

  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    return `${apiBase}${streamPath}`;
  }

  const origin = getBackendDirectHttpOrigin();
  const pathPrefix = apiBase.startsWith("/") ? apiBase : `/${apiBase}`;
  return `${origin}${pathPrefix}${streamPath}`;
}
