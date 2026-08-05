import {
  Building2,
  IndianRupee,
  LayoutDashboard,
  Network,
  Users2,
  type LucideIcon,
} from "lucide-react";

export type DistributorHeadTabId =
  | "overview"
  | "managers"
  | "distributors"
  | "branches"
  | "sales";

export const DISTRIBUTOR_HEAD_TAB_IDS = [
  "overview",
  "managers",
  "distributors",
  "branches",
  "sales",
] as const satisfies readonly DistributorHeadTabId[];

export type DistributorHeadTab = {
  id: DistributorHeadTabId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const DISTRIBUTOR_HEAD_TABS: DistributorHeadTab[] = [
  {
    id: "overview",
    label: "Overview",
    description: "State-wide hierarchy snapshot and headline metrics.",
    icon: LayoutDashboard,
  },
  {
    id: "managers",
    label: "Managers",
    description: "Branch managers reporting to this state head.",
    icon: Users2,
  },
  {
    id: "distributors",
    label: "Distributors",
    description: "All distributors under managers in this state.",
    icon: Network,
  },
  {
    id: "branches",
    label: "Branches",
    description: "Branches and cities covered in the state.",
    icon: Building2,
  },
  {
    id: "sales",
    label: "Sales",
    description: "Aggregated sales across the state network.",
    icon: IndianRupee,
  },
];

export function resolveDistributorHeadTab(tabSlug?: string): DistributorHeadTab {
  const match = DISTRIBUTOR_HEAD_TABS.find((tab) => tab.id === tabSlug);
  return match ?? DISTRIBUTOR_HEAD_TABS[0];
}

export function distributorHeadTabHref(tab: DistributorHeadTab) {
  return tab.id === "overview"
    ? "/dashboard/distributor-head"
    : `/dashboard/distributor-head/${tab.id}`;
}
