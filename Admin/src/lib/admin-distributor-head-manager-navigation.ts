import {
  Activity,
  CalendarDays,
  LayoutDashboard,
  Network,
  PieChart,
  Users2,
  type LucideIcon,
} from "lucide-react";

import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";

export type DistributorHeadManagerTabKey =
  | "overview"
  | "distributors"
  | "clients"
  | "book"
  | "leave"
  | "activity";

export type DistributorHeadManagerTab = {
  key: DistributorHeadManagerTabKey;
  slug: string;
  label: string;
  icon: LucideIcon;
};

export const DISTRIBUTOR_HEAD_MANAGER_TABS: DistributorHeadManagerTab[] = [
  { key: "overview", slug: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "distributors", slug: "distributors", label: MITRA_HIERARCHY_COPY.zyndMitras, icon: Network },
  { key: "clients", slug: "clients", label: "Clients", icon: Users2 },
  { key: "book", slug: "book", label: "Book", icon: PieChart },
  { key: "leave", slug: "leave", label: "Leave", icon: CalendarDays },
  { key: "activity", slug: "activity", label: "Activity", icon: Activity },
];

export const DISTRIBUTOR_HEAD_MANAGER_TAB_SLUGS = new Set(
  DISTRIBUTOR_HEAD_MANAGER_TABS.map((tab) => tab.slug),
);

export function resolveDistributorHeadManagerTab(
  tabSlug?: string,
): DistributorHeadManagerTab {
  if (!tabSlug) return DISTRIBUTOR_HEAD_MANAGER_TABS[0];
  return (
    DISTRIBUTOR_HEAD_MANAGER_TABS.find((tab) => tab.slug === tabSlug) ??
    DISTRIBUTOR_HEAD_MANAGER_TABS[0]
  );
}

export function distributorHeadManagerTabHref(managerId: string, tab: DistributorHeadManagerTab) {
  if (tab.key === "overview") {
    return `/dashboard/distributor-head/managers/${encodeURIComponent(managerId)}`;
  }
  return `/dashboard/distributor-head/managers/${encodeURIComponent(managerId)}/${tab.slug}`;
}
