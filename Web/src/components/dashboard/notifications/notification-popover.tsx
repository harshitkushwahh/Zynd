"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";

import { NotificationUnreadEmptyState } from "@/components/dashboard/notifications/notification-unread-empty-state";
import { NotificationEmptyState } from "@/components/dashboard/notifications/notification-empty-state";
import { NotificationListItem } from "@/components/dashboard/notifications/notification-list-item";
import { NotificationListSkeleton } from "@/components/dashboard/notifications/notification-list-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NOTIFICATION_FILTER_TAB_TRACK_CLASS,
  NOTIFICATION_SURFACE_RADIUS_CLASS,
  notificationFilterTabClass,
  notificationFilterTabCountClass,
  type NotificationFilter,
} from "@/features/notifications/lib/notification-filter-tabs";
import { useNotifications } from "@/contexts/notification-context";
import { refreshWithMinimumDuration } from "@/features/notifications/lib/refresh-with-minimum-duration";
import { cn } from "@/lib/utils";

export function NotificationPopover() {
  const { notifications, unreadCount, loading, refresh, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const loadedUnreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications],
  );

  const displayUnreadCount = Math.max(unreadCount, loadedUnreadCount);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.read_at);
    }
    return notifications;
  }, [filter, notifications]);

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    try {
      await refreshWithMinimumDuration(refresh);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label="Notifications"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "relative size-10 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            />
          }
        >
          <Bell className="size-4" />
          {displayUnreadCount > 0 ? (
            <Badge className="absolute -top-0.5 -right-0.5 size-4 justify-center rounded-full bg-destructive p-0 text-[10px] text-background">
              {displayUnreadCount > 9 ? "9+" : displayUnreadCount}
            </Badge>
          ) : null}
        </TooltipTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className={cn(
          "w-[22rem] overflow-hidden p-0 sm:w-96",
          NOTIFICATION_SURFACE_RADIUS_CLASS,
        )}
      >
        <PopoverHeader className="gap-1 border-b border-border bg-muted/20 px-4 pt-4 pb-3">
          <div
            className={cn(
              "flex justify-between gap-3",
              displayUnreadCount > 0 ? "items-start" : "items-center",
            )}
          >
            <div className="min-w-0">
              <PopoverTitle className="text-body font-semibold">Notifications</PopoverTitle>
              {displayUnreadCount > 0 ? (
                <PopoverDescription className="text-caption text-muted-foreground">
                  {displayUnreadCount} unread update{displayUnreadCount === 1 ? "" : "s"}
                </PopoverDescription>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-full"
                aria-label="Refresh notifications"
                aria-busy={refreshing}
                disabled={refreshing}
                onClick={() => void handleRefresh()}
              >
                <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
              </Button>
              {displayUnreadCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-full"
                  aria-label="Mark all read"
                  onClick={() => void markAllRead()}
                >
                  <CheckCheck className="size-3.5" strokeWidth={2.25} />
                </Button>
              ) : null}
            </div>
          </div>

          <div className={cn("mt-4", NOTIFICATION_FILTER_TAB_TRACK_CLASS)}>
            {(["all", "unread"] as const).map((value) => {
              const active = filter === value;
              const count = value === "unread" ? displayUnreadCount : notifications.length;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={notificationFilterTabClass(active)}
                >
                  {value === "all" ? "All" : "Unread"}
                  <span className={notificationFilterTabCountClass(active)}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </PopoverHeader>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
          {loading && notifications.length === 0 ? (
            <NotificationListSkeleton />
          ) : filteredNotifications.length === 0 ? (
            filter === "unread" && notifications.length > 0 ? (
              <NotificationUnreadEmptyState className="py-10" />
            ) : (
              <NotificationEmptyState />
            )
          ) : (
            <ul className="divide-y divide-border/70">
              {filteredNotifications.map((item) => (
                <NotificationListItem
                  key={item.id}
                  item={item}
                  onMarkRead={(id) => void markRead(id)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border bg-muted/10 px-3 py-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-center text-compact"
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
