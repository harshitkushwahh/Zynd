export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Zynd Support",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api/v1",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  /** Support user detail UI uses dummy investor profiles until support user APIs ship. */
  useBackendClients: false,
} as const;
