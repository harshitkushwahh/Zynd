import {
  Bell,
  KeyRound,
  Laptop,
  Mail,
  Shield,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type AdminSettingsSection =
  | "profile"
  | "change-password"
  | "change-email"
  | "mfa"
  | "devices"
  | "preferences";

export type AdminSettingsNavGroup = {
  id: string;
  label: string;
};

export type AdminSettingsNavItem = {
  id: AdminSettingsSection;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  group: AdminSettingsNavGroup["id"];
  /** Any one permission grants access. Empty = all signed-in admins. */
  permissions?: string[];
};

export const ADMIN_SETTINGS_GROUPS: AdminSettingsNavGroup[] = [
  { id: "account", label: "Account" },
  { id: "workspace", label: "Workspace" },
  { id: "platform", label: "Platform" },
];

export const ADMIN_SETTINGS_NAV: AdminSettingsNavItem[] = [
  {
    id: "profile",
    label: "Profile",
    title: "Profile",
    description: "Your admin account details and sign-in status",
    icon: UserRound,
    group: "account",
  },
  {
    id: "change-password",
    label: "Password",
    title: "Change password",
    description: "Update your sign-in password",
    icon: KeyRound,
    group: "account",
  },
  {
    id: "change-email",
    label: "Email",
    title: "Change email",
    description: "Update the email address for your admin account",
    icon: Mail,
    group: "account",
  },
  {
    id: "mfa",
    label: "MFA and PIN lock",
    title: "MFA and PIN lock",
    description: "Authenticator app, backup codes, and console PIN lock",
    icon: Shield,
    group: "account",
  },
  {
    id: "devices",
    label: "Devices",
    title: "Your devices",
    description: "Active sessions and signed-in devices",
    icon: Laptop,
    group: "account",
  },
  {
    id: "preferences",
    label: "Preferences",
    title: "Console preferences",
    description: "Notifications and table display options",
    icon: Bell,
    group: "platform",
  },
];

export function canAccessSettingsSection(
  item: AdminSettingsNavItem,
  hasPermission: (key: string) => boolean,
) {
  if (!item.permissions?.length) return true;
  return item.permissions.some((permission) => hasPermission(permission));
}

export function getVisibleSettingsNav(hasPermission: (key: string) => boolean) {
  return ADMIN_SETTINGS_NAV.filter((item) => canAccessSettingsSection(item, hasPermission));
}

export function resolveSettingsSection(
  sectionSlug: string | undefined,
  hasPermission: (key: string) => boolean,
): AdminSettingsNavItem | null {
  const visible = getVisibleSettingsNav(hasPermission);
  if (!visible.length) return null;
  if (!sectionSlug) return visible[0];
  return visible.find((item) => item.id === sectionSlug) ?? visible[0];
}

export function settingsSectionHref(section: AdminSettingsSection) {
  return `/dashboard/settings/${section}`;
}

export function isSettingsSectionActive(pathname: string, section: AdminSettingsSection) {
  return pathname === settingsSectionHref(section);
}

export function getSettingsPageTitle(section: AdminSettingsNavItem | null) {
  if (!section) return "Settings";
  return section.title;
}

/** Provider cards for Zynd Integrations panel */
export const MF_INTEGRATION_PROVIDERS = [
  {
    id: "finprim",
    label: "Fintech Primitive",
    description: "Orders, payments, SIP plans, mandates, and webhooks",
    logsFilter: "finprim",
  },
  {
    id: "cybrilla",
    label: "Cybrilla",
    description: "Scheme catalog ingestion and staging promote jobs",
    logsFilter: "cybrilla",
  },
  {
    id: "kyckart",
    label: "KYC Kart",
    description: "Investor KYC verification and document checks",
    logsFilter: "kyckart",
  },
] as const;

export const ZYND_LOGS_HREF = "/dashboard/zynd-logs";
