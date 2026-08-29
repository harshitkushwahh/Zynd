import { Mail, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FamilyGroupsTabId = "groups" | "invites";

export type FamilyGroupsTab = {
  id: FamilyGroupsTabId;
  label: string;
  description: string;
  icon: LucideIcon;
  permissions?: string[];
};

export const FAMILY_GROUPS_TABS: FamilyGroupsTab[] = [
  {
    id: "groups",
    label: "Groups",
    description: "Directory of customer family groups.",
    icon: UsersRound,
    permissions: ["family_groups.read"],
  },
  {
    id: "invites",
    label: "Invites",
    description: "Pending and historical invites across groups.",
    icon: Mail,
    permissions: ["family_groups.read"],
  },
];

export function resolveFamilyGroupsTab(tabSlug?: string): FamilyGroupsTab {
  const match = FAMILY_GROUPS_TABS.find((tab) => tab.id === tabSlug);
  return match ?? FAMILY_GROUPS_TABS[0];
}

export function familyGroupsTabHref(tab: FamilyGroupsTab) {
  return tab.id === "groups" ? "/dashboard/family-groups" : `/dashboard/family-groups/${tab.id}`;
}

export function familyGroupsGroupHref(groupId: string) {
  return `/dashboard/family-groups/${encodeURIComponent(groupId)}`;
}

export function isFamilyGroupsTabSlug(slug?: string) {
  if (!slug) return true;
  return FAMILY_GROUPS_TABS.some((tab) => tab.id === slug) || slug === "audit";
}
