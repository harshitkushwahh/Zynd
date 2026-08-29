import { env } from "@/lib/env";

export const APP_NAME = env.appName;
export const APP_TAGLINE = env.appTagline;

export function appTitle(pageLabel?: string): string {
  const trimmed = pageLabel?.trim();
  if (trimmed) return `${trimmed} · ${APP_NAME}`;
  return `${APP_TAGLINE} · ${APP_NAME}`;
}

export function appBrandLockup(): string {
  return `${APP_NAME} · ${APP_TAGLINE.toUpperCase()}`;
}
