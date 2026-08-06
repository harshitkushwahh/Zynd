import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

export type NotificationFilter = "all" | "unread";

export const NOTIFICATION_SURFACE_RADIUS_CLASS = ZYND_3XL_RADIUS_CLASS;

export const NOTIFICATION_FILTER_TAB_TRACK_CLASS =
  "flex gap-1 rounded-[var(--radius-full)] bg-tab-track p-1";

export function notificationFilterTabClass(active: boolean) {
  return cn(
    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-1.5 text-caption font-medium transition-colors",
    active
      ? "bg-background text-foreground shadow-zynd-low"
      : "text-muted-foreground hover:text-foreground",
  );
}

export function notificationFilterTabCountClass(active: boolean) {
  return cn(
    "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
    active
      ? "bg-muted text-foreground"
      : "bg-background/70 text-muted-foreground",
  );
}
