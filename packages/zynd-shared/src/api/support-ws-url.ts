import { getBackendDirectHttpOrigin } from "./backend-direct-origin";
import { getApiUrl } from "./configure";

/**
 * WebSockets must hit FastAPI directly. The Next.js `/api/v1` HTTP proxy does not upgrade WS.
 */
export function getSupportWebSocketUrl(accessToken: string): string {
  const token = encodeURIComponent(accessToken);
  const apiBase = getApiUrl().replace(/\/$/, "");

  const explicit =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SUPPORT_WS_BASE?.replace(/\/$/, "")
      : undefined;
  if (explicit) {
    return `${explicit}/support/ws?token=${token}`;
  }

  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    const wsBase = apiBase.replace(/^http/, "ws");
    return `${wsBase}/support/ws?token=${token}`;
  }

  const httpOrigin = getBackendDirectHttpOrigin();
  const wsOrigin = httpOrigin.replace(/^http/i, "ws");

  const pathPrefix = apiBase.startsWith("/") ? apiBase : `/${apiBase}`;
  return `${wsOrigin}${pathPrefix}/support/ws?token=${token}`;
}
