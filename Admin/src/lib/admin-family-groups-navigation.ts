import { Mail, ScrollText, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FamilyGroupsTabId = "groups" | "invites" | "audit";

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
  {
    id: "audit",
    label: "Audit log",
    description: "Family group lifecycle and moderation events.",
    icon: ScrollText,
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
