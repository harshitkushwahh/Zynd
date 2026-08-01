import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? ZYND_MITRA_COPY.consoleName,
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api/v1",
  useBackendClients: process.env.NEXT_PUBLIC_DISTRIBUTOR_USE_API === "true",
} as const;
