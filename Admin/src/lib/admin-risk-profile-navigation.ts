import { FileSpreadsheet, FolderTree, Layers3, Lock, MessageSquareText, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RiskProfileTabId =
  | "categories"
  | "questions"
  | "templates"
  | "tiers"
  | "users"
  | "locked";

export type RiskProfileTab = {
  id: RiskProfileTabId;
  label: string;
  description: string;
  icon: LucideIcon;
  permissions?: string[];
};

export const RISK_PROFILE_TABS: RiskProfileTab[] = [
  {
    id: "users",
    label: "User risk profile",
    description: "Risk profiles across all users.",
    icon: Users,
    permissions: ["risk_profile.users.read"],
  },
  {
    id: "locked",
    label: "Locked profiles",
    description: "Users who reached their attempt limit and need admin unlock.",
    icon: Lock,
    permissions: ["risk_profile.users.manage"],
  },
  {
    id: "categories",
    label: "Categories",
    description: "Weighted question categories that drive scoring.",
    icon: FolderTree,
    permissions: ["risk_profile.read"],
  },
  {
    id: "questions",
    label: "Questions",
    description: "Question bank, single-question editor, and CSV bulk import.",
    icon: MessageSquareText,
    permissions: ["risk_profile.read"],
  },
  {
    id: "templates",
    label: "Templates",
    description: "Question counts per category with auto-template selection.",
    icon: Layers3,
    permissions: ["risk_profile.read"],
  },
  {
    id: "tiers",
    label: "Tier messages",
    description: "Score bands from 0–1000 and user-facing tier messages.",
    icon: FileSpreadsheet,
    permissions: ["risk_profile.read"],
  },
];

export function resolveRiskProfileTab(tabSlug?: string): RiskProfileTab {
  const normalizedSlug = tabSlug === "bulk" ? "questions" : tabSlug;
  const match = RISK_PROFILE_TABS.find((tab) => tab.id === normalizedSlug);
  return match ?? RISK_PROFILE_TABS[0];
}

export function riskProfileTabHref(tab: RiskProfileTab) {
  return tab.id === "users" ? "/dashboard/risk-profile" : `/dashboard/risk-profile/${tab.id}`;
}
