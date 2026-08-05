import { Bell, KeyRound, Shield, UserRound, type LucideIcon } from "lucide-react";

export type DistributorSettingsSection =
  | "profile"
  | "change-password"
  | "security"
  | "notifications";

export type DistributorSettingsNavItem = {
  id: DistributorSettingsSection;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const DISTRIBUTOR_SETTINGS_NAV: DistributorSettingsNavItem[] = [
  {
    id: "profile",
    label: "Profile",
    title: "Profile",
    description: "",
    icon: UserRound,
  },
  {
    id: "change-password",
    label: "Update password",
    title: "Update password",
    description: "",
    icon: KeyRound,
  },
  {
    id: "security",
    label: "Security",
    title: "Security",
    description: "",
    icon: Shield,
  },
  {
    id: "notifications",
    label: "Notifications",
    title: "Notifications",
    description: "",
    icon: Bell,
  },
];

export function resolveDistributorSettingsSection(
  sectionSlug: string | undefined,
): DistributorSettingsNavItem {
  if (!sectionSlug) return DISTRIBUTOR_SETTINGS_NAV[0];
  return (
    DISTRIBUTOR_SETTINGS_NAV.find((item) => item.id === sectionSlug) ?? DISTRIBUTOR_SETTINGS_NAV[0]
  );
}

export function distributorSettingsSectionHref(section: DistributorSettingsSection) {
  return `/dashboard/settings/${section}`;
}

export function isDistributorSettingsSectionActive(
  pathname: string,
  section: DistributorSettingsSection,
) {
  return pathname === distributorSettingsSectionHref(section);
}
