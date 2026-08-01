"use client";

import type { DistributorNotification } from "@/lib/dummy/notifications";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { getDistributorNotificationVisual } from "@/components/notifications/get-distributor-notification-visual";

type DistributorNotificationListItemProps = {
  item: DistributorNotification;
  onMarkRead: (id: string) => void;
  variant?: "page" | "popover";
};

export function DistributorNotificationListItem({
  item,
  onMarkRead,
  variant = "page",
}: DistributorNotificationListItemProps) {
  const visual = getDistributorNotificationVisual(item);
  const Icon = visual.icon;

  return (
    <li className="distributor-notification-list__item">
      <button
        type="button"
        className={cn(
          "distributor-notification-card",
          variant === "popover" && "distributor-notification-card--popover",
          !item.read && "distributor-notification-card--unread",
        )}
        onClick={() => onMarkRead(item.id)}
        aria-label={`${item.read ? "" : "Unread: "}${item.title}. ${item.body}`}
      >
        <span className={cn("distributor-notification-card__icon", visual.iconClassName)}>
          <Icon className="distributor-notification-card__icon-svg" strokeWidth={1.85} aria-hidden />
          {!item.read ? (
            <span className="distributor-notification-card__unread-dot" aria-hidden />
          ) : null}
        </span>

        <span className="distributor-notification-card__content">
          <span className="distributor-notification-card__head">
            <span className="distributor-notification-card__title-row">
              <span className="distributor-notification-card__eyebrow">{visual.label}</span>
              <span className="distributor-notification-card__title">{item.title}</span>
            </span>
            <time className="distributor-notification-card__time" dateTime={item.createdAt}>
              {formatRelativeTime(item.createdAt)}
            </time>
          </span>
          <span className="distributor-notification-card__body">{item.body}</span>
        </span>
      </button>
    </li>
  );
}
