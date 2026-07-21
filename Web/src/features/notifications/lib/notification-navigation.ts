import { resolveNotificationDeepLink, type NotificationDeepLinkInput } from "@zynd/shared/notifications";

export function buildNotificationHref(input: NotificationDeepLinkInput): string {
  const resolved = resolveNotificationDeepLink(input);
  const params = new URLSearchParams();

  if (resolved.settingsSection) {
    params.set("section", resolved.settingsSection);
  }

  const inviteToken = input.metadata?.invite_token;
  if (typeof inviteToken === "string" && inviteToken) {
    params.set("family_invite", inviteToken);
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
