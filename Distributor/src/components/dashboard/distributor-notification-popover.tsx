"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell } from "lucide-react";

import { DistributorNotificationFilterTabs } from "@/components/notifications/distributor-notification-filter-tabs";
import { DistributorNotificationListItem } from "@/components/notifications/distributor-notification-list-item";
import { DistributorNotificationMarkAllReadButton } from "@/components/notifications/distributor-notification-mark-all-read-button";
import { DistributorNotificationsEmptyState } from "@/components/notifications/distributor-notifications-empty-state";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDistributorNotifications } from "@/contexts/distributor-notifications-context";
import {
  DISTRIBUTOR_NOTIFICATION_POPOVER_BODY_CLASS,
  DISTRIBUTOR_NOTIFICATION_POPOVER_CLASS,
  DISTRIBUTOR_NOTIFICATION_POPOVER_FILTERS_CLASS,
  DISTRIBUTOR_NOTIFICATION_POPOVER_FOOTER_CLASS,
  DISTRIBUTOR_NOTIFICATION_POPOVER_HEADER_CLASS,
  DISTRIBUTOR_POPOVER_BADGE_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

export function DistributorNotificationPopover() {
  const { notifications, unreadCount, markRead, markAllRead } = useDistributorNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filtered = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.read);
    }
    return notifications;
  }, [filter, notifications]);

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
            <DistributorNotificationMarkAllReadButton
              unreadCount={unreadCount}
              onClick={markAllRead}
              className="h-8 px-2.5 text-caption"
            />
          </div>
        </div>

        <div className={DISTRIBUTOR_NOTIFICATION_POPOVER_FILTERS_CLASS}>
          <DistributorNotificationFilterTabs
            filter={filter}
            onFilterChange={setFilter}
          />
        </div>

        <div className={DISTRIBUTOR_NOTIFICATION_POPOVER_BODY_CLASS}>
          {filtered.length === 0 ? (
            <div className="distributor-notification-popover__empty-wrap">
              <DistributorNotificationsEmptyState filter={filter} compact />
            </div>
          ) : (
            <ul className="distributor-notifications-list distributor-notifications-list--popover">
              {filtered.map((item) => (
                <DistributorNotificationListItem
                  key={item.id}
                  item={item}
                  onMarkRead={markRead}
                  variant="popover"
                />
              ))}
            </ul>
          )}
        </div>

        <div className={DISTRIBUTOR_NOTIFICATION_POPOVER_FOOTER_CLASS}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="distributor-notification-popover__footer-action"
            nativeButton={false}
            render={<Link href="/dashboard/notifications" />}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
