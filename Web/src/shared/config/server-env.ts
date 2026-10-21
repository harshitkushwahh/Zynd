/** Server-only env (API routes, not exposed to the client bundle). */

/** Max wait for FastAPI response headers/body through the Next.js BFF proxy. */
const backendProxyTimeoutMs = Number.parseInt(process.env.BACKEND_PROXY_TIMEOUT_MS ?? "120000", 10);

function resolveBackendUrl(): string {
  const configured = process.env.BACKEND_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  // Vercel serverless has no local FastAPI; default to production API when unset.
  if (process.env.VERCEL === "1") {
    return "https://api.zynd.shop";
  }
  return "http://localhost:8000";
}

export const serverEnv = {
  backendUrl: resolveBackendUrl(),
  backendProxyTimeoutMs: Number.isFinite(backendProxyTimeoutMs) ? backendProxyTimeoutMs : 120_000,
} as const;
