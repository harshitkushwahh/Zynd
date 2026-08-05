"use client";

import { useEffect, useMemo, useState } from "react";

import { DistributorNotificationFilterTabs } from "@/components/notifications/distributor-notification-filter-tabs";
import { DistributorNotificationListItem } from "@/components/notifications/distributor-notification-list-item";
import { DistributorNotificationMarkAllReadButton } from "@/components/notifications/distributor-notification-mark-all-read-button";
import { DistributorNotificationsEmptyState } from "@/components/notifications/distributor-notifications-empty-state";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { PaginationPageMinimalCenter } from "@/components/application/table/pagination";
import { useDistributorNotifications } from "@/contexts/distributor-notifications-context";
import { DISTRIBUTOR_EMPTY_REGION_CLASS, DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";

const PAGE_SIZE = 10;

type NotificationsPanelProps = {
  title: string;
};

export function NotificationsPanel({ title }: NotificationsPanelProps) {
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
      <DistributorPageHeader title={title} description="">
        <DistributorNotificationMarkAllReadButton unreadCount={unreadCount} onClick={markAllRead} />
      </DistributorPageHeader>

      <DistributorNotificationFilterTabs
        className="distributor-notifications-page__filters sm:max-w-xs"
        filter={filter}
        onFilterChange={setFilter}
      />

      <div className="overflow-hidden rounded-card border border-border bg-card shadow-zynd-low">
        <div className={DISTRIBUTOR_EMPTY_REGION_CLASS}>
          {pageItems.length === 0 ? (
            <div className="p-4 sm:p-6">
              <DistributorNotificationsEmptyState filter={filter} />
            </div>
          ) : (
            <ul className="distributor-notifications-list">
              {pageItems.map((item) => (
                <DistributorNotificationListItem
                  key={item.id}
                  item={item}
                  onMarkRead={markRead}
                  variant="page"
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
