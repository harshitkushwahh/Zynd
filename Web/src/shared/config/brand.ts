import { env } from "@/lib/env";

export const APP_NAME = env.appName;
export const APP_TAGLINE = env.appTagline;

export function appTitle(suffix?: string): string {
  if (!suffix) return `${APP_NAME} — ${APP_TAGLINE}`;
  return `${APP_NAME} — ${suffix}`;
}

export function appBrandLockup(): string {
  return `${APP_NAME} · ${APP_TAGLINE.toUpperCase()}`;
}
