import type { QueryClient } from "@tanstack/react-query";

import {
  type NotificationItem,
  type NotificationListResponse,
} from "@/features/notifications/api/notifications-api";
import type { NotificationsListParams } from "@/features/notifications/hooks/use-notifications-list-query";

function isNotificationsListKey(queryKey: readonly unknown[]): queryKey is readonly [
  "notifications",
  "list",
  NotificationsListParams,
] {
  return queryKey[0] === "notifications" && queryKey[1] === "list";
}

function forEachNotificationsListCache(
  queryClient: QueryClient,
  updater: (
    current: NotificationListResponse,
    params: NotificationsListParams,
  ) => NotificationListResponse | undefined,
) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ["notifications", "list"] })) {
    if (!isNotificationsListKey(query.queryKey)) continue;

    queryClient.setQueryData<NotificationListResponse>(query.queryKey, (current) => {
      if (!current) return current;
      return updater(current, query.queryKey[2]) ?? current;
    });
  }
}

export function prependNotificationToListCaches(
  queryClient: QueryClient,
  item: NotificationItem,
  unreadCount: number,
) {
  forEachNotificationsListCache(queryClient, (current, params) => {
    if (params.offset !== 0) return current;
    if (params.unreadOnly && item.read_at) return current;

    if (current.items.some((entry) => entry.id === item.id)) {
      return { ...current, unread_count: unreadCount };
    }

    const items = [item, ...current.items].slice(0, params.limit);
    return {
      ...current,
      items,
      total: current.total + 1,
      unread_count: unreadCount,
    };
  });
}

export function patchNotificationInListCaches(
  queryClient: QueryClient,
  notificationId: string,
  updater: (item: NotificationItem) => NotificationItem,
) {
  forEachNotificationsListCache(queryClient, (current) => {
    const hasItem = current.items.some((entry) => entry.id === notificationId);
    if (!hasItem) return current;

    const items = current.items.map((entry) =>
      entry.id === notificationId ? updater(entry) : entry,
    );

    const wasUnread = current.items.some(
      (entry) => entry.id === notificationId && !entry.read_at,
    );
    const isUnread = items.some((entry) => entry.id === notificationId && !entry.read_at);
    const unreadDelta = wasUnread && !isUnread ? -1 : !wasUnread && isUnread ? 1 : 0;

    return {
      ...current,
      items,
      unread_count: Math.max(0, current.unread_count + unreadDelta),
    };
  });
}

export function markAllNotificationsReadInListCaches(queryClient: QueryClient, readAt: string) {
  forEachNotificationsListCache(queryClient, (current) => ({
    ...current,
    items: current.items.map((item) => ({
      ...item,
      read_at: item.read_at ?? readAt,
    })),
    unread_count: 0,
  }));
}
