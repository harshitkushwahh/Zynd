import { Gift, History, ListTree, Settings2, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { clientIdToProfilePath } from "@/lib/admin-user-ref";

export type ReferralsTabId = "overview" | "directory" | "leaderboard" | "redemptions" | "rewards";

export type ReferralsTab = {
  id: ReferralsTabId;
  label: string;
  description: string;
  icon: LucideIcon;
  permissions?: string[];
};

export const REFERRALS_TABS: ReferralsTab[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Referrer directory and program KPIs.",
    icon: Users,
    permissions: ["referrals.read"],
  },
  {
    id: "directory",
    label: "Attributions",
    description: "All referral signups and stage progress.",
    icon: ListTree,
    permissions: ["referrals.read"],
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    description: "Monthly rankings, scoring rules, and program eligibility.",
    icon: Trophy,
    permissions: ["referrals.read"],
  },
  {
    id: "redemptions",
    label: "Redemption history",
    description: "Accrued rewards and payout status.",
    icon: History,
    permissions: ["referrals.read"],
  },
  {
    id: "rewards",
    label: "Reward categories",
    description: "Configure referral reward rules and campaigns.",
    icon: Settings2,
    permissions: ["referrals.read"],
  },
];

export function resolveReferralsTab(tabSlug?: string): ReferralsTab {
  return REFERRALS_TABS.find((tab) => tab.id === tabSlug) ?? REFERRALS_TABS[0];
}

export function referralsTabHref(tab: ReferralsTab) {
  return tab.id === "overview" ? "/dashboard/referrals" : `/dashboard/referrals/${tab.id}`;
}

export function referralReferrerDetailHref(userRef: string) {
  return `/dashboard/referrals/referrers/${encodeURIComponent(clientIdToProfilePath(userRef))}`;
}
