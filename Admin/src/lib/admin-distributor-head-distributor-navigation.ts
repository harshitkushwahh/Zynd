import {
  Activity,
  BarChart3,
  CalendarDays,
  Clock,
  LayoutDashboard,
  PieChart,
  Users2,
  type LucideIcon,
} from "lucide-react";

export type DistributorHeadDistributorTabKey =
  | "overview"
  | "clients"
  | "book"
  | "reports"
  | "leave"
  | "work"
  | "activity";

export type DistributorHeadDistributorTab = {
  key: DistributorHeadDistributorTabKey;
  slug: string;
  label: string;
  icon: LucideIcon;
};

export const DISTRIBUTOR_HEAD_DISTRIBUTOR_TABS: DistributorHeadDistributorTab[] = [
  { key: "overview", slug: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "clients", slug: "clients", label: "Clients", icon: Users2 },
  { key: "book", slug: "book", label: "Book", icon: PieChart },
  { key: "reports", slug: "reports", label: "Reports", icon: BarChart3 },
  { key: "leave", slug: "leave", label: "Leave", icon: CalendarDays },
  { key: "work", slug: "work", label: "Work", icon: Clock },
  { key: "activity", slug: "activity", label: "Activity", icon: Activity },
];

export const DISTRIBUTOR_HEAD_DISTRIBUTOR_TAB_SLUGS = new Set(
  DISTRIBUTOR_HEAD_DISTRIBUTOR_TABS.map((tab) => tab.slug),
);

export function resolveDistributorHeadDistributorTab(
  tabSlug?: string,
): DistributorHeadDistributorTab {
  if (!tabSlug) return DISTRIBUTOR_HEAD_DISTRIBUTOR_TABS[0];
  return (
    DISTRIBUTOR_HEAD_DISTRIBUTOR_TABS.find((tab) => tab.slug === tabSlug) ??
    DISTRIBUTOR_HEAD_DISTRIBUTOR_TABS[0]
  );
}

export function distributorHeadDistributorTabHref(
  distributorId: string,
  tab: DistributorHeadDistributorTab,
) {
  if (tab.key === "overview") {
    return `/dashboard/distributor-head/distributors/${encodeURIComponent(distributorId)}`;
  }
  return `/dashboard/distributor-head/distributors/${encodeURIComponent(distributorId)}/${tab.slug}`;
}
