/**
 * FastAPI origin for browser long-lived connections (WebSocket, SSE).
 * Next.js `/api/v1` BFF proxy is HTTP-only and capped by serverless timeouts.
 */
export function getBackendDirectHttpOrigin(): string {
  const httpExplicit =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_BACKEND_HTTP_ORIGIN?.trim().replace(/\/$/, "")
      : undefined;
  if (httpExplicit) {
    return httpExplicit;
  }

  const wsOrigin =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_BACKEND_WS_ORIGIN?.trim().replace(/\/$/, "")
      : undefined;
  if (wsOrigin) {
    return wsOrigin.replace(/^ws/i, "http");
  }

  return "http://127.0.0.1:8000";
}
