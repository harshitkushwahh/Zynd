/** Layout class names — styles live in `src/styles/distributor.css`. */

export const DISTRIBUTOR_SIDEBAR_EXPANDED_WIDTH = "var(--distributor-sidebar-width-expanded)";
export const DISTRIBUTOR_SIDEBAR_ICON_WIDTH = "var(--distributor-sidebar-width-icon)";
export const DISTRIBUTOR_SIDEBAR_CHROME_CLASS = "distributor-sidebar-chrome";
export const DISTRIBUTOR_SIDEBAR_COLLAPSED_UI_CLASS = "border-r-0";
export const DISTRIBUTOR_SIDEBAR_HEADER_CLASS = "distributor-sidebar-header";
export const DISTRIBUTOR_SIDEBAR_HEADER_COLLAPSED_CLASS =
  "distributor-sidebar-header distributor-sidebar-header--collapsed";
/** Legacy export — prefer CSS tokens; kept for table min-width naming. */
export const DISTRIBUTOR_SIDEBAR_WIDTH = "w-56";

export const DISTRIBUTOR_SHELL_CLASS = "distributor-shell";
export const DISTRIBUTOR_MAIN_COLUMN_CLASS = "distributor-main-column";
export const DISTRIBUTOR_MAIN_SCROLL_CLASS = "distributor-main-scroll";
export const DISTRIBUTOR_MAIN_CONTENT_CLASS = "distributor-main-content";
export const DISTRIBUTOR_PAGE_COLUMN_CLASS = "distributor-page-column";
export const DISTRIBUTOR_NAVBAR_SPACER_CLASS = "distributor-navbar-spacer";
export const DISTRIBUTOR_NAVBAR_OUTER_CLASS = "distributor-navbar-outer";
export const DISTRIBUTOR_NAVBAR_INNER_CLASS = "distributor-navbar-inner distributor-page-column";
export const DISTRIBUTOR_BREADCRUMB_ROW_CLASS = "distributor-breadcrumb-row";
export const DISTRIBUTOR_DASHBOARD_HOME_SPACER_CLASS = "distributor-dashboard-home-spacer";
export const DISTRIBUTOR_PAGE_STACK_CLASS = "distributor-page-stack";
export const DISTRIBUTOR_WORKSPACE_SPLIT_CLASS = "distributor-workspace-split";
export const DISTRIBUTOR_WORKSPACE_SPLIT_MAIN_CLASS = "distributor-workspace-split__main";
export const DISTRIBUTOR_SETTINGS_LAYOUT_CLASS = "distributor-settings-layout";
export const DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS = "distributor-table-col-created-at";
export const DISTRIBUTOR_LABEL_CAPS_CLASS = "distributor-label-caps";
export const DISTRIBUTOR_LABEL_CAPS_INLINE_END_CLASS =
  "distributor-label-caps distributor-label-caps--inline-end";
export const DISTRIBUTOR_LABEL_CAPS_SEMIBOLD_CENTER_CLASS =
  "distributor-label-caps distributor-label-caps--semibold distributor-label-caps--center";
export const DISTRIBUTOR_LABEL_CAPS_TINY_CLASS = "distributor-label-caps distributor-label-caps--tiny";
export const DISTRIBUTOR_STACK_SM_CLASS = "distributor-stack-sm";
export const DISTRIBUTOR_STACK_MD_CLASS = "distributor-stack-md";
export const DISTRIBUTOR_TABS_ROOT_CLASS = "distributor-tabs-root";
export const DISTRIBUTOR_TABS_CONTENT_CLASS = "distributor-tabs-content";
export const DISTRIBUTOR_OVERLAY_HEADER_CLASS = "distributor-overlay-header";
export const DISTRIBUTOR_OVERLAY_BODY_CLASS = "distributor-overlay-body";
export const DISTRIBUTOR_OVERLAY_BODY_SCROLL_CLASS = "distributor-overlay-body distributor-overlay-body--scroll";
export const DISTRIBUTOR_OVERLAY_FOOTER_CLASS = "distributor-overlay-footer";
export const DISTRIBUTOR_EMPTY_REGION_CLASS = "distributor-empty-region";
export const DISTRIBUTOR_INSET_SECTION_HEADER_CLASS = "distributor-inset-section-header";
export const DISTRIBUTOR_INSET_SECTION_BODY_CLASS = "distributor-inset-section-body";
export const DISTRIBUTOR_INSET_SECTION_ROW_CLASS = "distributor-inset-section-row";
export const DISTRIBUTOR_TEXT_MICRO_CLASS = "distributor-text-micro";
export const DISTRIBUTOR_TEXT_MICRO_TIGHT_CLASS = "distributor-text-micro-tight";
export const DISTRIBUTOR_TEXT_MICRO_TABULAR_CLASS = "distributor-text-micro-tabular";
export const DISTRIBUTOR_LOGIN_CONTENT_CLASS = "distributor-login-content";
export const DISTRIBUTOR_TABLE_PAGINATION_CLASS = "distributor-table-pagination";
export const DISTRIBUTOR_TABLE_CARD_HEADER_SM_CLASS = "distributor-table-card-header--sm";
export const DISTRIBUTOR_TABLE_CARD_HEADER_MD_CLASS = "distributor-table-card-header--md";
export const DISTRIBUTOR_SETTINGS_TOGGLE_ROW_CLASS = "distributor-settings-toggle-row";
export const DISTRIBUTOR_WORKSPACE_SIDEBAR_CLASS = "distributor-workspace-sidebar";
export const DISTRIBUTOR_WORKSPACE_SIDEBAR_HEADER_CLASS = "distributor-workspace-sidebar__header";
export const DISTRIBUTOR_AVATAR_FALLBACK_MICRO_CLASS = "distributor-avatar-fallback-micro";
export const DISTRIBUTOR_BADGE_COMPACT_CLASS = "distributor-badge-compact";
export const DISTRIBUTOR_SELECTION_BADGE_CLASS = "distributor-selection-badge";
export const DISTRIBUTOR_POPOVER_BADGE_CLASS = "distributor-popover-badge";
export const DISTRIBUTOR_NOTIFICATION_POPOVER_CLASS = "distributor-notification-popover";
export const DISTRIBUTOR_NOTIFICATION_POPOVER_HEADER_CLASS = "distributor-notification-popover__header";
export const DISTRIBUTOR_NOTIFICATION_POPOVER_BODY_CLASS = "distributor-notification-popover__body";
export const DISTRIBUTOR_NOTIFICATION_POPOVER_FOOTER_CLASS = "distributor-notification-popover__footer";
export const DISTRIBUTOR_NOTIFICATION_FILTER_TABS_CLASS = "distributor-notification-filter-tabs";
export const DISTRIBUTOR_NOTIFICATION_FILTER_TAB_CLASS = "distributor-notification-filter-tab";
export const DISTRIBUTOR_NOTIFICATION_FILTER_TAB_ACTIVE_CLASS =
  "distributor-notification-filter-tab distributor-notification-filter-tab--active";
export const DISTRIBUTOR_RISK_CARD_INLINE_CLASS = "distributor-risk-card--inline";
export const DISTRIBUTOR_GAUGE_SCALE_LABELS_CLASS = "distributor-gauge-scale-labels";
export const DISTRIBUTOR_WORKSPACE_NAV_ITEM_CLASS = "distributor-workspace-nav-item";
export const DISTRIBUTOR_WORKSPACE_NAV_ITEM_ACTIVE_CLASS =
  "distributor-workspace-nav-item distributor-workspace-nav-item--active";
export const DISTRIBUTOR_WORKSPACE_NAV_ITEM_DISABLED_CLASS =
  "distributor-workspace-nav-item distributor-workspace-nav-item--disabled";

/** @deprecated Use DISTRIBUTOR_NAVBAR_SPACER_CLASS — height from `--distributor-navbar-height`. */
export const DISTRIBUTOR_NAVBAR_HEIGHT = DISTRIBUTOR_NAVBAR_SPACER_CLASS;

export function distributorSidebarContentTopClass(collapsed: boolean) {
  return collapsed
    ? "distributor-sidebar-content-top distributor-sidebar-content-top--collapsed"
    : "distributor-sidebar-content-top";
}

export function distributorBreadcrumbOffsetClass() {
  return DISTRIBUTOR_BREADCRUMB_ROW_CLASS;
}

export function distributorDashboardPageTopClass() {
  return DISTRIBUTOR_DASHBOARD_HOME_SPACER_CLASS;
}

export const DISTRIBUTOR_PAGE_X_PADDING = DISTRIBUTOR_PAGE_COLUMN_CLASS;
export const DISTRIBUTOR_PAGE_MIN_TOP_CLASS = "";
export const DISTRIBUTOR_BREADCRUMB_BOTTOM_CLASS = "";
export const DISTRIBUTOR_BREADCRUMB_TOP_CLASS = "";
