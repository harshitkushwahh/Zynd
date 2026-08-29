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

  const inviteId = input.metadata?.invite_id;
  if (typeof inviteId === "string" && inviteId) {
    params.set("family_invite_id", inviteId);
  }

  const recommendationToken = input.metadata?.recommendation_token;
  if (typeof recommendationToken === "string" && recommendationToken) {
    return `/dashboard/mutual-funds/recommendation/${encodeURIComponent(recommendationToken)}${
      params.toString() ? `?${params.toString()}` : ""
    }`;
  }

  const query = params.toString();
  return query ? `${resolved.path}?${query}` : resolved.path;
}

export function buildNotificationHrefFromPushData(data: Record<string, string | undefined>): string {
  let metadata: Record<string, unknown> | null = null;
  if (data.metadata) {
    try {
      metadata = JSON.parse(data.metadata) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }

  return buildNotificationHref({
    notification_type: data.notification_type ?? "",
    category: data.category as NotificationDeepLinkInput["category"],
    metadata,
  });
}
