export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Zynd Support",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api/v1",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  /** Enables document preview and risk report download against live client APIs. */
  useBackendClients: true,
} as const;
