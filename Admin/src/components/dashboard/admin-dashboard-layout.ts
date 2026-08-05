import { cn } from "@/lib/utils";

export const ADMIN_SIDEBAR_WIDTH = "w-60";
export const ADMIN_NAVBAR_HEIGHT = "admin-dashboard-navbar-spacer";
export const ADMIN_NAVBAR_CLASS = "admin-dashboard-navbar";
/** @deprecated Use ADMIN_NAVBAR_CLASS */
export const ADMIN_NAVBAR_INNER_CLASS = "admin-dashboard-navbar";
/** @deprecated Header wrapper removed */
export const ADMIN_NAVBAR_OUTER_CLASS = "admin-dashboard-navbar";
export const ADMIN_SHELL_PADDING = "p-0";
export const ADMIN_MAIN_SCROLL_CLASS = "admin-dashboard-main-scroll min-h-0 flex-1 overflow-y-auto";
export const ADMIN_MAIN_COLUMN_CLASS = "admin-dashboard-main-column";
export const ADMIN_SHELL_CLASS = "admin-dashboard-shell";
export const ADMIN_ACCOUNT_MENU_CLASS = "admin-account-menu";
export const ADMIN_ACCOUNT_MENU_PROFILE_CLASS = "admin-account-menu__profile";

/** @deprecated Use adminMainContentClass() for responsive width. */
export const ADMIN_MAIN_CONTENT_CLASS = "mx-auto w-full max-w-6xl px-6 py-8";

export function adminMainContentClass() {
  return cn("admin-dashboard-main-content mx-auto w-full min-w-0");
}
