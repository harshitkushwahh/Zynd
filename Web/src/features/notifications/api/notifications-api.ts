import { apiRequest } from "@/lib/api-client";

export type NotificationCategory = "security" | "kyc" | "referral" | "account";

export type NotificationItem = {
  id: string;
  category: NotificationCategory;
  notification_type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  total: number;
  unread_count: number;
};

export type NotificationPreference = {
  category: NotificationCategory;
  email_enabled: boolean;
  in_app_enabled: boolean;
  email_locked: boolean;
};

export async function fetchNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  if (params?.unreadOnly) search.set("unread_only", "true");
  const query = search.toString();
  return apiRequest<NotificationListResponse>(`/notifications${query ? `?${query}` : ""}`);
}

export async function fetchNotification(notificationId: string) {
  return apiRequest<NotificationItem>(`/notifications/${notificationId}`);
}

export async function fetchUnreadNotificationCount() {
  return apiRequest<{ unread_count: number }>("/notifications/unread-count");
}

export async function markNotificationRead(notificationId: string) {
  return apiRequest<NotificationItem>(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsRead() {
  return apiRequest<{ updated: number }>("/notifications/read-all", {
    method: "POST",
  });
}

export async function fetchNotificationPreferences() {
  return apiRequest<{ preferences: NotificationPreference[] }>("/notifications/preferences");
}

export async function updateNotificationPreference(payload: {
  category: NotificationCategory;
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
}) {
  return apiRequest<NotificationPreference>("/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify({
      category: payload.category,
      email_enabled: payload.emailEnabled,
      in_app_enabled: payload.inAppEnabled,
    }),
  });
}

export type PushPlatform = "ios" | "android" | "web";

export type PushDevice = {
  id: string;
  platform: PushPlatform;
  device_label: string | null;
  app_version: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchPushDevices() {
  return apiRequest<{ items: PushDevice[] }>("/notifications/devices");
}

export async function registerPushDevice(payload: {
  platform: PushPlatform;
  fcmToken: string;
  deviceLabel?: string;
  appVersion?: string;
}) {
  return apiRequest<PushDevice>("/notifications/devices", {
    method: "POST",
    body: JSON.stringify({
      platform: payload.platform,
      fcm_token: payload.fcmToken,
      device_label: payload.deviceLabel,
      app_version: payload.appVersion,
    }),
  });
}

export async function revokePushDevice(deviceId: string) {
  return apiRequest<{ revoked: boolean }>(`/notifications/devices/${deviceId}`, {
    method: "DELETE",
  });
}
