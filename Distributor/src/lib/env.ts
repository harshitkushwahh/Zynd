export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "ZYND Distributor",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api/v1",
  useBackendClients: process.env.NEXT_PUBLIC_DISTRIBUTOR_USE_API === "true",
} as const;
