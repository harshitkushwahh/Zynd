/** Layout class names — shell styles live in `Distributor/src/styles/distributor.css`. */

export const SUPPORT_SIDEBAR_EXPANDED_WIDTH = "var(--distributor-sidebar-width-expanded)";
export const SUPPORT_SIDEBAR_ICON_WIDTH = "var(--distributor-sidebar-width-icon)";
export const SUPPORT_SIDEBAR_CHROME_CLASS = "distributor-sidebar-chrome";
export const SUPPORT_SIDEBAR_COLLAPSED_UI_CLASS = "border-r-0";

export const SUPPORT_SHELL_CLASS = "distributor-shell";
export const SUPPORT_MAIN_COLUMN_CLASS = "distributor-main-column";
export const SUPPORT_MAIN_SCROLL_CLASS = "distributor-main-scroll";
export const SUPPORT_MAIN_CONTENT_CLASS = "distributor-main-content";
export const SUPPORT_NAVBAR_SPACER_CLASS = "distributor-navbar-spacer";
export const SUPPORT_NAVBAR_OUTER_CLASS = "distributor-navbar-outer";
export const SUPPORT_NAVBAR_INNER_CLASS = "distributor-navbar-inner distributor-page-column";
export const SUPPORT_BREADCRUMB_ROW_CLASS = "distributor-breadcrumb-row";
export const SUPPORT_ACCOUNT_MENU_CLASS = "distributor-account-menu";
export const SUPPORT_ACCOUNT_MENU_PROFILE_CLASS = "distributor-account-menu__profile";

/** @deprecated Use SUPPORT_NAVBAR_SPACER_CLASS */
export const SUPPORT_NAVBAR_HEIGHT = SUPPORT_NAVBAR_SPACER_CLASS;

export function supportBreadcrumbOffsetClass() {
  return SUPPORT_BREADCRUMB_ROW_CLASS;
}

/** Matched height for ticket detail chat (left) and details (right) columns. */
export const SUPPORT_TICKET_DETAIL_WORKSPACE_HEIGHT_CLASS =
  "h-[min(48rem,calc(100dvh-var(--distributor-navbar-height)-7.5rem))] min-h-[28rem] lg:h-[calc(100dvh-var(--distributor-navbar-height)-7.5rem)]";
