"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";

import { DistributorNotificationFilterTabs } from "@/components/notifications/distributor-notification-filter-tabs";
import { DistributorNotificationListItem } from "@/components/notifications/distributor-notification-list-item";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { resolveDistributorPageIcon } from "@/components/dashboard/distributor-page-icons";
import type { DistributorPageIconName } from "@/components/dashboard/distributor-page-icons";
import { PaginationPageMinimalCenter } from "@/components/application/table/pagination";
import { Button } from "@/components/ui/button";
import { useDistributorNotifications } from "@/contexts/distributor-notifications-context";
import { DISTRIBUTOR_EMPTY_REGION_CLASS, DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";

const PAGE_SIZE = 10;

type NotificationsPanelProps = {
  iconName: DistributorPageIconName;
  title: string;
  description: string;
};

export function NotificationsPanel({ iconName, title, description }: NotificationsPanelProps) {
  const Icon = resolveDistributorPageIcon(iconName);
  const { notifications, unreadCount, markRead, markAllRead } = useDistributorNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.read);
    }
    return notifications;
  }, [filter, notifications]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader icon={Icon} title={title} description={description} />

      <div className="overflow-hidden rounded-card border border-border bg-card shadow-zynd-low">
        <div className="border-b border-border bg-muted/20 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-compact font-medium text-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                  : "Your full notification history"}
              </p>
              <p className="text-caption text-muted-foreground">
                Txn requests, investor activity, and order updates for your book.
              </p>
            </div>
            {unreadCount > 0 ? (
              <Button type="button" size="sm" className="shrink-0 gap-1.5" onClick={markAllRead}>
                <CheckCheck className="size-3.5" strokeWidth={2.25} />
                Mark all read
              </Button>
            ) : null}
          </div>

          <DistributorNotificationFilterTabs
            className="mt-4 sm:max-w-xs"
            filter={filter}
            onFilterChange={setFilter}
            allCount={notifications.length}
            unreadCount={unreadCount}
          />
        </div>

        <div className={DISTRIBUTOR_EMPTY_REGION_CLASS}>
          {pageItems.length === 0 ? (
            <p className="px-4 py-16 text-center text-compact text-muted-foreground sm:px-6">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {pageItems.map((item) => (
                <DistributorNotificationListItem
                  key={item.id}
                  item={item}
                  onMarkRead={markRead}
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
    </div>
  );
}
