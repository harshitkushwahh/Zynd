const SIDEBAR_STORAGE_KEY = "zynd-admin-sidebar-open";
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function readStoredSidebarOpen(fallback = true): boolean {
  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // Ignore storage failures.
  }

  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`));
    if (match) {
      return match.split("=")[1] === "true";
    }
  } catch {
    // Ignore cookie read failures.
  }

  return fallback;
}

export function persistSidebarOpen(open: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
  } catch {
    // Ignore storage failures.
  }

  try {
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
  } catch {
    // Ignore cookie write failures.
  }
}
