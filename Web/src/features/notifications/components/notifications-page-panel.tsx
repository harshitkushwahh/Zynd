"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";

import { NotificationEmptyState } from "@/components/dashboard/notifications/notification-empty-state";
import { NotificationListItem } from "@/components/dashboard/notifications/notification-list-item";
import { NotificationUnreadEmptyState } from "@/components/dashboard/notifications/notification-unread-empty-state";
import { PaginationPageMinimalCenter } from "@/components/core/table";
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { FieldMessage } from "@/components/ui/ui-message";
import { useNotifications } from "@/contexts/notification-context";
import { useNotificationsListQuery } from "@/features/notifications/hooks/use-notifications-list-query";
import {
  NOTIFICATION_FILTER_TAB_TRACK_CLASS,
  NOTIFICATION_SURFACE_RADIUS_CLASS,
  notificationFilterTabClass,
  notificationFilterTabCountClass,
  type NotificationFilter,
} from "@/features/notifications/lib/notification-filter-tabs";
import { NotificationsPageSkeleton } from "@/features/notifications/components/notifications-page-skeleton";
import { refreshWithMinimumDuration } from "@/features/notifications/lib/refresh-with-minimum-duration";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function NotificationsBreadcrumb() {
  return <DashboardBreadcrumb items={[{ label: "Notifications" }]} />;
}

export function NotificationsPagePanel() {
  const { markRead, markAllRead, refresh: refreshContext } = useNotifications();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [allTotal, setAllTotal] = useState(0);

  const listParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      unreadOnly: filter === "unread",
    }),
    [filter, page],
  );

  const {
    items,
    total,
    unreadCount,
    showSkeleton,
    errorMessage,
    isFetching,
    refetch,
    isShowingPreviousData,
  } = useNotificationsListQuery(listParams);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (filter === "all" && total > 0) {
      setAllTotal(total);
    }
  }, [filter, total]);

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    try {
      await Promise.all([
        refreshWithMinimumDuration(refreshContext),
        refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    await markRead(notificationId);
  };

  if (showSkeleton) {
    return <NotificationsPageSkeleton />;
  }

  if (errorMessage && items.length === 0) {
    return (
      <>
        <NotificationsBreadcrumb />
        <FieldMessage message={errorMessage} />
      </>
    );
  }

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  return (
    <>
      <NotificationsBreadcrumb />

      <div
        className={cn(
          "overflow-hidden border border-border bg-card shadow-zynd-low",
          NOTIFICATION_SURFACE_RADIUS_CLASS,
        )}
      >
        <div className="border-b border-border bg-muted/20 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
                  <Bell className="size-4" strokeWidth={2.25} />
                </div>
                <div>
                  <PageTitle>All notifications</PageTitle>
                  <p className="text-caption text-muted-foreground">
                    {unreadCount > 0
                      ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                      : "Your full notification history"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={refreshing || isFetching}
                onClick={() => void handleRefresh()}
              >
                <RefreshCw className={cn("size-3.5", (refreshing || isFetching) && "animate-spin")} />
                Refresh
              </Button>
              {unreadCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="size-8 rounded-full"
                  aria-label="Mark all read"
                  onClick={() => void handleMarkAllRead()}
                >
                  <CheckCheck className="size-3.5" strokeWidth={2.25} />
                </Button>
              ) : null}
            </div>
          </div>

          <div className={cn("mt-4 sm:max-w-xs", NOTIFICATION_FILTER_TAB_TRACK_CLASS)}>
            {(["all", "unread"] as const).map((value) => {
              const active = filter === value;
              const count = value === "unread" ? unreadCount : filter === "all" ? total : allTotal;

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
        </div>

        <div
          className={cn(
            "min-h-[16rem] transition-opacity duration-200",
            isShowingPreviousData && isFetching && "opacity-70",
          )}
        >
          {items.length === 0 ? (
            filter === "unread" ? (
              <NotificationUnreadEmptyState />
            ) : (
              <NotificationEmptyState className="py-16" />
            )
          ) : (
            <ul className="divide-y divide-border/70">
              {items.map((item) => (
                <NotificationListItem
                  key={item.id}
                  item={item}
                  onMarkRead={(id) => void handleMarkRead(id)}
                />
              ))}
            </ul>
          )}
        </div>

        {totalPages > 1 ? (
          <PaginationPageMinimalCenter
            page={page}
            total={totalPages}
            onPageChange={setPage}
            className="border-t border-border px-4 py-3 sm:px-6"
          />
        ) : null}
      </div>
    </>
  );
}
