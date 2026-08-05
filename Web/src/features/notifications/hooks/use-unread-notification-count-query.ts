"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchUnreadNotificationCount } from "@/features/notifications/api/notifications-api";
import { queryKeys } from "@/lib/query-keys";

export function useUnreadNotificationCountQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.unread(),
    queryFn: fetchUnreadNotificationCount,
    enabled,
  });
}
