import { cn } from "@/lib/utils";

export const ADMIN_SIDEBAR_WIDTH = "w-60";
export const ADMIN_NAVBAR_HEIGHT = "admin-dashboard-navbar-spacer";
export const ADMIN_NAVBAR_OUTER_CLASS = "admin-dashboard-navbar-outer";
export const ADMIN_NAVBAR_INNER_CLASS = "admin-dashboard-navbar-inner";
export const ADMIN_SHELL_PADDING = "p-0";
export const ADMIN_MAIN_SCROLL_CLASS = "admin-dashboard-main-scroll min-h-0 flex-1 overflow-y-auto";
export const ADMIN_MAIN_COLUMN_CLASS = "admin-dashboard-main-column";
export const ADMIN_SHELL_CLASS = "admin-dashboard-shell";

/** @deprecated Use adminMainContentClass(collapsed) for responsive width. */
export const ADMIN_MAIN_CONTENT_CLASS = "mx-auto w-full max-w-6xl px-6 py-8";

export function adminMainContentClass(collapsed: boolean) {
  return cn(
    "admin-dashboard-main-content mx-auto w-full min-w-0 px-6 py-8",
    collapsed ? "admin-dashboard-main-content--collapsed" : "admin-dashboard-main-content--expanded",
  );
}
