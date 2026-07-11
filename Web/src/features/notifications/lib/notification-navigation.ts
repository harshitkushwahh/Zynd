import { resolveNotificationDeepLink, type NotificationDeepLinkInput } from "@zynd/shared/notifications";

export function buildNotificationHref(input: NotificationDeepLinkInput): string {
  const resolved = resolveNotificationDeepLink(input);
  const params = new URLSearchParams();

  if (resolved.settingsSection) {
    params.set("section", resolved.settingsSection);
  }

  const query = params.toString();
  return query ? `${resolved.path}?${query}` : resolved.path;
}

export function buildNotificationHrefFromPushData(data: Record<string, string | undefined>): string {
  return buildNotificationHref({
    notification_type: data.notification_type ?? "",
    category: data.category as NotificationDeepLinkInput["category"],
  });
}
