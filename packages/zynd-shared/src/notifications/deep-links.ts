export type NotificationCategory = "security" | "kyc" | "referral" | "account";

export type NotificationDeepLinkInput = {
  notification_type: string;
  category?: NotificationCategory;
  metadata?: Record<string, unknown> | null;
};

export type NotificationDeepLink = {
  path: string;
  settingsSection?: string;
};

const SECURITY_SETTINGS_SECTION = "security";
const NOTIFICATIONS_SETTINGS_SECTION = "notifications";

const NOTIFICATION_TYPE_ROUTES: Record<string, NotificationDeepLink> = {
  "auth.login.succeeded": { path: "/dashboard/settings", settingsSection: SECURITY_SETTINGS_SECTION },
  "auth.login.failed": { path: "/dashboard/settings", settingsSection: SECURITY_SETTINGS_SECTION },
  "auth.new_device": { path: "/dashboard/settings", settingsSection: SECURITY_SETTINGS_SECTION },
  "auth.password.changed": { path: "/dashboard/settings", settingsSection: SECURITY_SETTINGS_SECTION },
  "auth.email.changed": { path: "/dashboard/settings", settingsSection: "email" },
  "auth.email_change.requested": { path: "/dashboard/settings", settingsSection: "email" },
  "auth.mfa.enabled": { path: "/dashboard/settings", settingsSection: "mfa" },
  "auth.mfa.disabled": { path: "/dashboard/settings", settingsSection: "mfa" },
  "auth.device.revoked": { path: "/dashboard/settings", settingsSection: SECURITY_SETTINGS_SECTION },
  "auth.refresh_reuse.detected": { path: "/dashboard/settings", settingsSection: SECURITY_SETTINGS_SECTION },
  "auth.pin.set": { path: "/dashboard/settings", settingsSection: SECURITY_SETTINGS_SECTION },
  "auth.pin.reset": { path: "/dashboard/settings", settingsSection: SECURITY_SETTINGS_SECTION },
  "kyc.initiated": { path: "/dashboard/kyc" },
  "kyc.under_review": { path: "/dashboard/kyc" },
  "kyc.completed": { path: "/dashboard/kyc" },
  "kyc.rejected": { path: "/dashboard/kyc" },
  "referral.user.signed_up": { path: "/dashboard/referral/referrals" },
  "referral.kyc.verified": { path: "/dashboard/referral/referrals" },
  "referral.first_investment": { path: "/dashboard/referral/referrals" },
  "referral.qualified": { path: "/dashboard/referral" },
  "referral.engaged": { path: "/dashboard/referral" },
  "account.settings.changed": {
    path: "/dashboard/settings",
    settingsSection: NOTIFICATIONS_SETTINGS_SECTION,
  },
  "account.profile_image.updated": {
    path: "/dashboard/settings",
    settingsSection: "personal-details",
  },
};

const CATEGORY_FALLBACK_ROUTES: Record<NotificationCategory, NotificationDeepLink> = {
  security: { path: "/dashboard/settings", settingsSection: SECURITY_SETTINGS_SECTION },
  kyc: { path: "/dashboard/kyc" },
  referral: { path: "/dashboard/referral" },
  account: { path: "/dashboard/settings", settingsSection: NOTIFICATIONS_SETTINGS_SECTION },
};

export function resolveNotificationDeepLink(
  input: NotificationDeepLinkInput,
): NotificationDeepLink {
  const explicit = NOTIFICATION_TYPE_ROUTES[input.notification_type];
  if (explicit) {
    return explicit;
  }

  if (input.category) {
    return CATEGORY_FALLBACK_ROUTES[input.category];
  }

  return { path: "/dashboard/notifications" };
}

export function buildNotificationDeepLinkUrl(
  baseUrl: string,
  input: NotificationDeepLinkInput & { notification_id?: string },
): string {
  const resolved = resolveNotificationDeepLink(input);
  const url = new URL(resolved.path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  if (resolved.settingsSection) {
    url.searchParams.set("section", resolved.settingsSection);
  }

  if (input.notification_id) {
    url.searchParams.set("notification_id", input.notification_id);
  }

  url.searchParams.set("notification_type", input.notification_type);
  return `${url.pathname}${url.search}`;
}

export const PUSH_DEVICE_STORAGE_KEY = "zynd_push_device_id";
