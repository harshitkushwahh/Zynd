import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { normalizePublicApiUrl } from "@zynd/shared/api";

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? ZYND_MITRA_COPY.consoleName,
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiUrl: normalizePublicApiUrl(process.env.NEXT_PUBLIC_API_URL),
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  useBackendClients: true,
} as const;
