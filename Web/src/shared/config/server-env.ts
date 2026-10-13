/** Server-only env (API routes, not exposed to the client bundle). */

/** Max wait for FastAPI response headers/body through the Next.js BFF proxy. */
const backendProxyTimeoutMs = Number.parseInt(process.env.BACKEND_PROXY_TIMEOUT_MS ?? "120000", 10);

export const serverEnv = {
  backendUrl: process.env.BACKEND_URL ?? "http://localhost:8000",
  backendProxyTimeoutMs: Number.isFinite(backendProxyTimeoutMs) ? backendProxyTimeoutMs : 120_000,
} as const;
