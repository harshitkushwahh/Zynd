import {
  Activity,
  ClipboardCheck,
  Gauge,
  Goal,
  PieChart,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type UserProfileTabKey =
  | "portfolio"
  | "family"
  | "goals"
  | "kyc"
  | "risk"
  | "activity";

export type UserProfileTab = {
  key: UserProfileTabKey;
  slug: string;
  label: string;
  icon: LucideIcon;
  permissions?: string[];
  match?: "any" | "all";
};

export const USER_PROFILE_TABS: UserProfileTab[] = [
  {
    key: "portfolio",
    slug: "portfolio",
    label: "Portfolio",
    icon: PieChart,
    permissions: ["mf.transactions.read"],
  },
  {
    key: "family",
    slug: "family",
    label: "Family groups",
    icon: UsersRound,
    permissions: ["family_groups.read"],
  },
  {
    key: "goals",
    slug: "goals",
    label: "Goals calculator",
    icon: Goal,
    permissions: ["users.read"],
  },
  {
    key: "kyc",
    slug: "kyc",
    label: "KYC & identity",
    icon: ClipboardCheck,
    permissions: ["documents.read"],
  },
  {
    key: "risk",
    slug: "risk",
    label: "Risk profile",
    icon: Gauge,
    permissions: ["risk_profile.users.read"],
  },
  {
    key: "activity",
    slug: "activity",
    label: "Activity",
    icon: Activity,
    permissions: ["audit.read"],
  },
];

export const USER_PROFILE_TAB_SLUGS = new Set(USER_PROFILE_TABS.map((tab) => tab.slug));

export function userProfileTabHref(profilePath: string, tab: UserProfileTab) {
  return `/dashboard/users/${encodeURIComponent(profilePath)}/${tab.slug}`;
}

export function resolveUserProfileTab(
  tabSlug: string | undefined,
  hasPermission: (key: string) => boolean,
  hasProfileData?: {
    kyc?: boolean;
    investments?: boolean;
  },
): UserProfileTab | null {
  const visible = USER_PROFILE_TABS.filter((tab) => {
    if (tab.key === "kyc" && !hasProfileData?.kyc) return false;
    if (tab.key === "portfolio" && !hasProfileData?.investments) return false;
    if (!tab.permissions?.length) return true;
    if (tab.match === "all") {
      return tab.permissions.every((permission) => hasPermission(permission));
    }
    return tab.permissions.some((permission) => hasPermission(permission));
  });

  if (!visible.length) return null;
  if (!tabSlug) return visible[0];
  return visible.find((tab) => tab.slug === tabSlug) ?? visible[0];
}
