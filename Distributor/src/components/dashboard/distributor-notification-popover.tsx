"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";

import { DistributorNotificationFilterTabs } from "@/components/notifications/distributor-notification-filter-tabs";
import { DistributorNotificationListItem } from "@/components/notifications/distributor-notification-list-item";
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
              className={cn(
                "relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              )}
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
            <div className="min-w-0">
              <p className="distributor-notification-popover__title">Notifications</p>
              <p className="distributor-notification-popover__description">
                {unreadCount > 0 ? (
                  <>
                    <span className="distributor-notification-popover__unread-accent">
                      {unreadCount} unread update{unreadCount === 1 ? "" : "s"}
                    </span>
                  </>
                ) : (
                  "Stay on top of distributor activity"
                )}
              </p>
            </div>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-2 text-caption"
                onClick={markAllRead}
              >
                <CheckCheck className="size-3.5" strokeWidth={2.25} />
                Mark all read
              </Button>
            ) : null}
          </div>

          <DistributorNotificationFilterTabs
            className="distributor-notification-popover__filters"
            filter={filter}
            onFilterChange={setFilter}
            allCount={notifications.length}
            unreadCount={unreadCount}
          />
        </div>

        <div className={DISTRIBUTOR_NOTIFICATION_POPOVER_BODY_CLASS}>
          {filtered.length === 0 ? (
            <p className="distributor-notification-popover__empty">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {filtered.map((item) => (
                <DistributorNotificationListItem
                  key={item.id}
                  item={item}
                  onMarkRead={markRead}
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
