"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useNotifications } from "@/contexts/notification-context";
import { buildNotificationHref } from "@/features/notifications/lib/notification-navigation";

export function NotificationDeepLinkHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { markRead } = useNotifications();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const notificationId = searchParams.get("notification_id");
    const notificationType = searchParams.get("notification_type");
    const category = searchParams.get("category");

    if (!notificationId && !notificationType) {
      return;
    }

    const key = `${notificationId ?? ""}:${notificationType ?? ""}:${category ?? ""}`;
    if (handledRef.current === key) {
      return;
    }
    handledRef.current = key;

    if (notificationId) {
      void markRead(notificationId);
    }

    if (notificationType) {
      router.replace(
        buildNotificationHref({
          notification_type: notificationType,
          category: (category as "security" | "kyc" | "referral" | "account" | "family" | null) ?? undefined,
        }),
      );
    }
  }, [markRead, router, searchParams]);

  return null;
}
