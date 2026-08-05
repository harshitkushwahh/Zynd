"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchNotifications,
  type NotificationListResponse,
} from "@/features/notifications/api/notifications-api";
import { keepPreviousQueryData } from "@/lib/query-utils";
import { queryKeys } from "@/lib/query-keys";

export type NotificationsListParams = {
  limit: number;
  offset: number;
  unreadOnly: boolean;
};

export function useNotificationsListQuery(params: NotificationsListParams) {
  const query = useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () =>
      fetchNotifications({
        limit: params.limit,
        offset: params.offset,
        unreadOnly: params.unreadOnly,
      }),
    placeholderData: keepPreviousQueryData,
  });

  return {
    ...query,
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    unreadCount: query.data?.unread_count ?? 0,
    showSkeleton: query.isPending && !query.data,
    isShowingPreviousData: query.isPlaceholderData,
    errorMessage: query.error ? "Could not load notifications. Please try again." : "",
  };
}

export function useNotificationsPreviewQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.preview(),
    queryFn: () => fetchNotifications({ limit: 20 }),
    enabled,
  });
}

export function patchNotificationPreviewCache(
  queryClient: import("@tanstack/react-query").QueryClient,
  updater: (current: NotificationListResponse | undefined) => NotificationListResponse | undefined,
) {
  queryClient.setQueryData(queryKeys.notifications.preview(), updater);
}
