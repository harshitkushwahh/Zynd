import { storageKeys } from "@/shared/config/storage-keys";

export type Theme = "light" | "dark";

const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(storageKeys.theme);
    if (value === "light" || value === "dark") return value;
  } catch {
    return null;
  }

  return null;
}

export function parseThemeCookie(value: string | undefined): Theme | null {
  if (value === "light" || value === "dark") return value;
  return null;
}

export function resolveTheme(): Theme {
  return readStoredTheme() ?? getSystemTheme();
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function persistTheme(theme: Theme) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKeys.theme, theme);
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }

  try {
    document.cookie = `${storageKeys.theme}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch {
    // Ignore cookie failures (privacy mode, blocked storage, etc.).
  }
}
