/** Server-only env (API routes, not exposed to the client bundle). */

export const serverEnv = {
  backendUrl: process.env.BACKEND_URL ?? "http://localhost:8000",
} as const;
