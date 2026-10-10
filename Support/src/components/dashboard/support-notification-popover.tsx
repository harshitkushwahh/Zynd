"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCheck, Info, Megaphone } from "lucide-react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DISTRIBUTOR_NOTIFICATION_FILTER_TAB_ACTIVE_CLASS,
  DISTRIBUTOR_NOTIFICATION_FILTER_TAB_CLASS,
  DISTRIBUTOR_NOTIFICATION_FILTER_TABS_CLASS,
  DISTRIBUTOR_NOTIFICATION_POPOVER_BODY_CLASS,
  DISTRIBUTOR_NOTIFICATION_POPOVER_CLASS,
  DISTRIBUTOR_NOTIFICATION_POPOVER_FILTERS_CLASS,
  DISTRIBUTOR_NOTIFICATION_POPOVER_HEADER_CLASS,
  DISTRIBUTOR_POPOVER_BADGE_CLASS,
} from "@/lib/distributor-layout";
import { formatRelativeTime } from "@/lib/format";
import {
  SUPPORT_NOTIFICATIONS_SEED,
  type SupportNotification,
  type SupportNotificationTone,
} from "@/lib/support-notifications-dummy-data";
import { cn } from "@/lib/utils";

type NotificationFilter = "all" | "unread";

function toneIcon(tone: SupportNotificationTone) {
  if (tone === "warning") return AlertTriangle;
  return Info;
}

function toneIconClass(tone: SupportNotificationTone) {
  if (tone === "warning") {
    return "distributor-notification-card__icon--compliance";
  }
  return "distributor-notification-card__icon--lead";
}

function SupportNotificationListItem({
  item,
  onMarkRead,
}: {
  item: SupportNotification;
  onMarkRead: (id: string) => void;
}) {
  const Icon = toneIcon(item.tone);

  return (
    <li className="distributor-notification-list__item">
      <button
        type="button"
        className={cn(
          "distributor-notification-card distributor-notification-card--popover",
          !item.read && "distributor-notification-card--unread",
        )}
        onClick={() => onMarkRead(item.id)}
        aria-label={`${item.read ? "" : "Unread: "}${item.title}. ${item.body}`}
      >
        <span className={cn("distributor-notification-card__icon", toneIconClass(item.tone))}>
          <Icon className="distributor-notification-card__icon-svg" strokeWidth={1.85} aria-hidden />
          {!item.read ? <span className="distributor-notification-card__unread-dot" aria-hidden /> : null}
        </span>

        <span className="distributor-notification-card__content">
          <span className="distributor-notification-card__head">
            <span className="distributor-notification-card__title-row">
              <span className="distributor-notification-card__eyebrow">Announcement</span>
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

export function SupportNotificationPopover() {
  const [notifications, setNotifications] = useState(SUPPORT_NOTIFICATIONS_SEED);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const filtered = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.read);
    }
    return notifications;
  }, [filter, notifications]);

  const markRead = (id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  };

  const markAllRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label="Notifications"
              render={
                <DistributorActionButton
                  type="button"
                  variant="icon"
                  className="relative shrink-0"
                />
              }
            />
          }
        >
          <Bell className="size-4" strokeWidth={2.25} />
          {unreadCount > 0 ? (
            <span className={DISTRIBUTOR_POPOVER_BADGE_CLASS} aria-hidden>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </TooltipTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className={DISTRIBUTOR_NOTIFICATION_POPOVER_CLASS}
      >
        <div className={DISTRIBUTOR_NOTIFICATION_POPOVER_HEADER_CLASS}>
          <div className="distributor-notification-popover__title-row">
            <p className="distributor-notification-popover__title">Notifications</p>
            {unreadCount > 0 ? (
              <DistributorActionButton
                type="button"
                variant="outline"
                size="sm"
                className="distributor-notification-mark-all-read relative shrink-0 gap-1.5 h-8 px-2.5 text-caption"
                onClick={markAllRead}
                aria-label={`Mark all read, ${unreadCount} unread`}
              >
                <CheckCheck className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                Mark all read
                <span className="distributor-notification-mark-all-read__badge" aria-hidden>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              </DistributorActionButton>
            ) : null}
          </div>
        </div>

        <div className={DISTRIBUTOR_NOTIFICATION_POPOVER_FILTERS_CLASS}>
          <div className={DISTRIBUTOR_NOTIFICATION_FILTER_TABS_CLASS}>
            {(["all", "unread"] as const).map((value) => {
              const active = filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={
                    active
                      ? DISTRIBUTOR_NOTIFICATION_FILTER_TAB_ACTIVE_CLASS
                      : DISTRIBUTOR_NOTIFICATION_FILTER_TAB_CLASS
                  }
                >
                  {value === "all" ? "All" : "Unread"}
                </button>
              );
            })}
          </div>
        </div>

        <div className={DISTRIBUTOR_NOTIFICATION_POPOVER_BODY_CLASS}>
          {filtered.length === 0 ? (
            <div className="distributor-notification-popover__empty-wrap">
              <Card className="distributor-notifications-empty-card distributor-notifications-empty-card--compact border-border bg-muted/20 shadow-none">
                <div className="distributor-notifications-empty-card__body">
                  <span className="distributor-notifications-empty-card__icon" aria-hidden>
                    {filter === "unread" ? (
                      <Bell className="size-5" strokeWidth={1.75} />
                    ) : (
                      <Megaphone className="size-5" strokeWidth={1.75} />
                    )}
                  </span>
                  <div className="distributor-notifications-empty-card__copy">
                    <p className="distributor-notifications-empty-card__title">
                      {filter === "unread" ? "No unread announcements" : "No announcements"}
                    </p>
                    <p className="distributor-notifications-empty-card__description">
                      {filter === "unread"
                        ? "You're caught up on console announcements."
                        : "Product and operations announcements will appear here."}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <ul className="distributor-notifications-list distributor-notifications-list--popover">
              {filtered.map((item) => (
                <SupportNotificationListItem key={item.id} item={item} onMarkRead={markRead} />
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
