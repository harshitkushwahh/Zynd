import type { NotificationStreamPayload } from "@/features/notifications/api/notification-stream";
import type { NotificationCategory } from "@/features/notifications/api/notifications-api";
import { WEB_PUSH_NOTIFICATION_EVENT } from "@/features/notifications/lib/firebase-web-config";

export function parseFcmDataPayload(
  data: Record<string, string | undefined>,
): NotificationStreamPayload | null {
  const id = data.notification_id;
  const title = data.title;
  const body = data.body;
  const notificationType = data.notification_type;
  const category = data.category as NotificationCategory | undefined;

  if (!id || !title || !body || !notificationType || !category) {
    return null;
  }

  let metadata: Record<string, unknown> | null = null;
  if (data.metadata) {
    try {
      metadata = JSON.parse(data.metadata) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }

  const unreadCount = Number.parseInt(data.unread_count ?? "0", 10);

  return {
    id,
    category,
    notification_type: notificationType,
    title,
    body,
    metadata,
    read_at: null,
    created_at: new Date().toISOString(),
    unread_count: Number.isFinite(unreadCount) ? unreadCount : 0,
  };
}

export function dispatchWebPushNotification(payload: NotificationStreamPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(WEB_PUSH_NOTIFICATION_EVENT, {
      detail: payload,
    }),
  );
}
