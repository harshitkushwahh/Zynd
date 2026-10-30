const API_V1_SUFFIX = /\/api\/v1$/i;

/** Client-facing API base (paths like `/auth/refresh` are appended to this). */
export function normalizePublicApiUrl(raw: string | undefined, fallback = "/api/v1"): string {
  const configured = raw?.trim();
  if (!configured) return fallback;
  const trimmed = configured.replace(/\/$/, "");
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  if (API_V1_SUFFIX.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}/api/v1`;
}

/** FastAPI origin for server-side BFF proxy (no `/api/v1`  the proxy adds it). */
export function normalizeBackendOrigin(raw: string): string {
  return raw.trim().replace(/\/$/, "").replace(API_V1_SUFFIX, "");
}
