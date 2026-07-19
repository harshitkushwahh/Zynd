import { cn } from "@/lib/utils";
import { ADMIN_OVERLAY_CLASS } from "@/components/ui/admin-design-tokens";

export const ADMIN_DIALOG_SIZE_CLASS = {
  sm: "max-w-md",
  md: "max-w-lg",
  detail: "max-w-3xl",
  wide: "max-w-4xl",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
} as const;

export type AdminDialogSize = keyof typeof ADMIN_DIALOG_SIZE_CLASS;

export const ADMIN_DIALOG_OVERLAY_CLASS = cn(
  "fixed inset-0 z-50 transition-opacity ease-out data-starting-style:opacity-0 data-ending-style:opacity-0",
  ADMIN_OVERLAY_CLASS,
  "transition-opacity duration-[var(--duration-overlay)]",
);

export const ADMIN_DIALOG_CONTENT_CLASS = cn(
  "fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-var(--dialog-inset-x))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-modal border border-border bg-card shadow-zynd-high outline-none",
  "transition-[opacity,transform] ease-out duration-[var(--duration-overlay)]",
  "data-starting-style:opacity-0 data-ending-style:opacity-0",
  "data-starting-style:scale-[var(--dialog-scale-enter)] data-ending-style:scale-[var(--dialog-scale-enter)]",
);

export const ADMIN_DIALOG_HEADER_CLASS =
  "flex shrink-0 items-start gap-3 border-b border-border px-5 py-4";

export const ADMIN_DIALOG_BODY_CLASS = "min-h-0 flex-1 overflow-y-auto px-5 py-5";

export const ADMIN_DIALOG_FOOTER_CLASS =
  "flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4";

export const ADMIN_DIALOG_ICON_TONE_CLASS = {
  default: "bg-muted/50 text-muted-foreground",
  info: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
} as const;

export type AdminDialogIconTone = keyof typeof ADMIN_DIALOG_ICON_TONE_CLASS;

export function adminDialogContentClass(size: AdminDialogSize = "md", className?: string) {
  return cn(ADMIN_DIALOG_CONTENT_CLASS, ADMIN_DIALOG_SIZE_CLASS[size], className);
}

export function adminDialogIconClass(tone: AdminDialogIconTone = "default") {
  return cn(
    "flex size-10 shrink-0 items-center justify-center rounded-card",
    ADMIN_DIALOG_ICON_TONE_CLASS[tone],
  );
}
