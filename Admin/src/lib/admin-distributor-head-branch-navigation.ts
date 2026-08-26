import {
  Activity,
  IndianRupee,
  LayoutDashboard,
  Network,
  Users2,
  type LucideIcon,
} from "lucide-react";

import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";

export type DistributorHeadBranchTabKey =
  | "overview"
  | "mitras"
  | "clients"
  | "book"
  | "activity";

export type DistributorHeadBranchTab = {
  key: DistributorHeadBranchTabKey;
  slug: string;
  label: string;
  icon: LucideIcon;
};

export const DISTRIBUTOR_HEAD_BRANCH_TABS: DistributorHeadBranchTab[] = [
  { key: "overview", slug: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "mitras", slug: "mitras", label: MITRA_HIERARCHY_COPY.zyndMitras, icon: Network },
  { key: "clients", slug: "clients", label: "Clients", icon: Users2 },
  { key: "book", slug: "book", label: "Book", icon: IndianRupee },
  { key: "activity", slug: "activity", label: "Activity", icon: Activity },
];

export const DISTRIBUTOR_HEAD_BRANCH_TAB_SLUGS = new Set(
  DISTRIBUTOR_HEAD_BRANCH_TABS.map((tab) => tab.slug),
);

export function resolveDistributorHeadBranchTab(tabSlug?: string): DistributorHeadBranchTab {
  if (!tabSlug) return DISTRIBUTOR_HEAD_BRANCH_TABS[0];
  return (
    DISTRIBUTOR_HEAD_BRANCH_TABS.find((tab) => tab.slug === tabSlug) ??
    DISTRIBUTOR_HEAD_BRANCH_TABS[0]
  );
}

export function distributorHeadBranchHref(branchId: string) {
  return `/dashboard/distributor-head/branches/${encodeURIComponent(branchId)}`;
}

export function distributorHeadBranchTabHref(branchId: string, tab: DistributorHeadBranchTab) {
  if (tab.key === "overview") {
    return distributorHeadBranchHref(branchId);
  }
  return `/dashboard/distributor-head/branches/${encodeURIComponent(branchId)}/${tab.slug}`;
}
