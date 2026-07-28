"use client";

import type { DistributorNotification } from "@/lib/dummy/notifications";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type DistributorNotificationListItemProps = {
  item: DistributorNotification;
  onMarkRead: (id: string) => void;
};

export function DistributorNotificationListItem({
  item,
  onMarkRead,
}: DistributorNotificationListItemProps) {
  return (
    <li>
      <button
        type="button"
        className={cn(
          "distributor-list-row-button",
          !item.read && "distributor-list-row-button--unread",
        )}
        onClick={() => onMarkRead(item.id)}
      >
        <div className="distributor-list-row-button__inner">
          {!item.read ? (
            <span className="distributor-list-unread-dot" aria-hidden />
          ) : (
            <span className="distributor-list-unread-dot--placeholder" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-compact font-medium text-foreground">{item.title}</p>
            <p className="text-caption text-muted-foreground">{item.body}</p>
            <p className="distributor-list-row-meta">{formatRelativeTime(item.createdAt)}</p>
          </div>
        </div>
      </button>
    </li>
  );
}
