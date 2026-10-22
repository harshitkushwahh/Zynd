import { normalizePublicApiUrl } from "@zynd/shared/api";

function resolvePublicZtoEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_ZTO_ENABLED;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return (process.env.NEXT_PUBLIC_APP_ENV ?? "development") === "development";
}

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "ZYND",
  appTagline: process.env.NEXT_PUBLIC_APP_TAGLINE ?? "Your Wealth. Your Way.",
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  apiUrl: normalizePublicApiUrl(process.env.NEXT_PUBLIC_API_URL),
  /** When true, signup shows Cybrilla lookup checkboxes even if /kyc/zero-touch/config is unreachable. */
  ztoEnabled: resolvePublicZtoEnabled(),
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  appleClientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? "",
  appleRedirectUri: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "",
  },
} as const;
