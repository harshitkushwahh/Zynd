export {
  distributorStateHeadHref as distributorHeadStateHeadHref,
  distributorStateHeadTabHref as distributorHeadStateHeadTabHref,
} from "@/lib/admin-user-ref";

import {
  Building2,
  CalendarDays,
  IndianRupee,
  LayoutDashboard,
  Network,
  Users2,
  type LucideIcon,
} from "lucide-react";

import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";

export type DistributorHeadStateHeadTabKey =
  | "overview"
  | "managers"
  | "branches"
  | "mitras"
  | "book"
  | "clients"
  | "leave";

export type DistributorHeadStateHeadTab = {
  key: DistributorHeadStateHeadTabKey;
  slug: string;
  label: string;
  icon: LucideIcon;
};

export const DISTRIBUTOR_HEAD_STATE_HEAD_TABS: DistributorHeadStateHeadTab[] = [
  { key: "overview", slug: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "managers", slug: "managers", label: MITRA_HIERARCHY_COPY.branchManagers, icon: Users2 },
  { key: "branches", slug: "branches", label: "Branches", icon: Building2 },
  { key: "mitras", slug: "mitras", label: MITRA_HIERARCHY_COPY.zyndMitras, icon: Network },
  { key: "book", slug: "book", label: "Book", icon: IndianRupee },
  { key: "clients", slug: "clients", label: "Clients", icon: Users2 },
  { key: "leave", slug: "leave", label: "Leave", icon: CalendarDays },
];

export const DISTRIBUTOR_HEAD_STATE_HEAD_TAB_SLUGS = new Set(
  DISTRIBUTOR_HEAD_STATE_HEAD_TABS.map((tab) => tab.slug),
);

export function resolveDistributorHeadStateHeadTab(
  tabSlug?: string,
): DistributorHeadStateHeadTab {
  if (!tabSlug) return DISTRIBUTOR_HEAD_STATE_HEAD_TABS[0];
  return (
    DISTRIBUTOR_HEAD_STATE_HEAD_TABS.find((tab) => tab.slug === tabSlug) ??
    DISTRIBUTOR_HEAD_STATE_HEAD_TABS[0]
  );
}
