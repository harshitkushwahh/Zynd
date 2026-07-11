"use client";

import { formatDistanceToNow } from "date-fns";

import { NOTIFICATION_CATEGORY_META } from "@/features/notifications/lib/notification-category-meta";
import { useNotificationNavigation } from "@/features/notifications/hooks/use-notification-navigation";
import type { NotificationItem } from "@/features/notifications/api/notifications-api";
import { cn } from "@/lib/utils";

type NotificationListItemProps = {
  item: NotificationItem;
  onMarkRead: (id: string) => void;
};

export function NotificationListItem({ item, onMarkRead }: NotificationListItemProps) {
  const meta = NOTIFICATION_CATEGORY_META[item.category];
  const Icon = meta.icon;
  const unread = !item.read_at;
  const navigateToNotification = useNotificationNavigation(onMarkRead);

  return (
    <li>
      <button
        type="button"
        className={cn(
          "group flex w-full gap-3 border-l-2 px-3 py-3 text-left transition-colors hover:bg-muted/50",
          unread ? meta.accentClassName : "border-l-transparent",
        )}
        onClick={() => navigateToNotification(item)}
      >
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/70 ring-1 ring-border/50",
            unread && "ring-primary/20",
          )}
        >
          <Icon className={cn("size-4", meta.iconClassName)} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-compact font-medium text-foreground">{item.title}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {meta.label}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {unread ? (
                <span className="size-2 rounded-full bg-primary shadow-[0_0_0_2px_var(--background)]" />
              ) : null}
              <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <p className="mt-1.5 line-clamp-2 text-caption leading-relaxed text-muted-foreground">
            {item.body}
          </p>
        </div>
      </button>
    </li>
  );
}
