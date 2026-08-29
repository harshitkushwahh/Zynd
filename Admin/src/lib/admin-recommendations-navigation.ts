import { FlaskConical, Layers3, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RecommendationsTabId = "baskets" | "publish" | "preview";

export type RecommendationsTab = {
  id: RecommendationsTabId;
  label: string;
  description: string;
  icon: LucideIcon;
  permissions?: string[];
};

export const RECOMMENDATIONS_TABS: RecommendationsTab[] = [
  {
    id: "baskets",
    label: "Baskets",
    description: "Tier baskets, fund pools, and basket metadata.",
    icon: Layers3,
    permissions: ["recommendations.read"],
  },
  {
    id: "publish",
    label: "Publish & ops",
    description: "Readiness checks, runtime metrics, and config publish.",
    icon: Upload,
    permissions: ["recommendations.read"],
  },
  {
    id: "preview",
    label: "Preview",
    description: "Deterministic sample-user recommendation preview.",
    icon: FlaskConical,
    permissions: ["recommendations.read"],
  },
];

export function resolveRecommendationsTab(tabSlug?: string): RecommendationsTab {
  const match = RECOMMENDATIONS_TABS.find((tab) => tab.id === tabSlug);
  return match ?? RECOMMENDATIONS_TABS[0];
}

export function recommendationsTabHref(tab: RecommendationsTab) {
  return tab.id === "baskets" ? "/dashboard/recommendations" : `/dashboard/recommendations/${tab.id}`;
}
