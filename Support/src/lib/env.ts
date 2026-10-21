import { normalizePublicApiUrl } from "@zynd/shared/api";

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Zynd Support",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiUrl: normalizePublicApiUrl(process.env.NEXT_PUBLIC_API_URL),
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  /** Enables document preview and risk report download against live client APIs. */
  useBackendClients: true,
} as const;
