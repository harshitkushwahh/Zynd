/** Shared Admin layout class names backed by CSS tokens in zynd-brand.css */

export const ADMIN_TABLE_MIN_WIDTH = {
  sm: "min-w-table-sm",
  md: "min-w-table-md",
  lg: "min-w-table-lg",
  xl: "min-w-table-xl",
  "2xl": "min-w-table-2xl",
  default: "min-w-table-default",
  "3xl": "min-w-table-3xl",
  "4xl": "min-w-table-4xl",
  "5xl": "min-w-table-5xl",
  "6xl": "min-w-table-6xl",
  "7xl": "min-w-table-7xl",
} as const;

export type AdminTableMinWidth = keyof typeof ADMIN_TABLE_MIN_WIDTH;

export const ADMIN_FIELD_MIN_HEIGHT = {
  xs: "min-h-field-xs",
  sm: "min-h-field-sm",
  md: "min-h-field-md",
  lg: "min-h-field-lg",
  xl: "min-h-field-xl",
  "2xl": "min-h-field-2xl",
} as const;

export type AdminFieldMinHeight = keyof typeof ADMIN_FIELD_MIN_HEIGHT;

export const ADMIN_SELECT_MIN_WIDTH = {
  xs: "min-w-select-xs",
  sm: "min-w-select-sm",
  md: "min-w-select-md",
  lg: "min-w-select-lg",
  xl: "min-w-select-xl",
} as const;

export type AdminSelectMinWidth = keyof typeof ADMIN_SELECT_MIN_WIDTH;

export const ADMIN_SCROLL_MAX_HEIGHT = {
  sm: "max-h-scroll-sm",
  md: "max-h-scroll-md",
  lg: "max-h-scroll-lg",
} as const;

export const ADMIN_EMPTY_STATE_PADDING = {
  sm: "py-empty-state-sm",
  md: "py-empty-state-md",
  lg: "py-empty-state-lg",
  xl: "py-empty-state-xl",
} as const;

export const ADMIN_DIALOG_MAX_HEIGHT_CLASS = "max-h-dialog";
export const ADMIN_DIALOG_BODY_SCROLL_CLASS = "max-h-dialog-body";
export const ADMIN_DIALOG_DETAIL_BODY_SCROLL_CLASS = "max-h-dialog-body-detail";
export const ADMIN_DIALOG_WIDE_BODY_SCROLL_CLASS = "max-h-dialog-body-wide";
export const ADMIN_DIALOG_FORM_BODY_SCROLL_CLASS = "max-h-dialog-body-form";

export const ADMIN_TEXT_MICRO = "text-micro";
export const ADMIN_TEXT_TINY = "text-tiny";

export const ADMIN_STATUS_SUCCESS = "bg-success/10 text-success";
export const ADMIN_STATUS_WARNING = "bg-warning/10 text-warning";
export const ADMIN_STATUS_SUCCESS_PANEL = "border border-success/25 bg-success/5";
export const ADMIN_OVERLAY_CLASS = "backdrop-zynd-overlay";
