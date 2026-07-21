"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import type { NotificationItem } from "@/features/notifications/api/notifications-api";
import { buildNotificationHref } from "@/features/notifications/lib/notification-navigation";

type NotificationNavigationOptions = {
  markReadOnNavigate?: boolean;
};

export function useNotificationNavigation(
  onMarkRead?: (notificationId: string) => void,
  options?: NotificationNavigationOptions,
) {
  const router = useRouter();
  const markReadOnNavigate = options?.markReadOnNavigate ?? true;

  return useCallback(
    (item: Pick<NotificationItem, "id" | "notification_type" | "category" | "read_at" | "metadata">) => {
      if (markReadOnNavigate && !item.read_at) {
        onMarkRead?.(item.id);
      }

      router.push(
        buildNotificationHref({
          notification_type: item.notification_type,
          category: item.category,
          metadata: item.metadata,
        }),
      );
    },
    [markReadOnNavigate, onMarkRead, router],
  );
}
