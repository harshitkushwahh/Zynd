import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarClock,
  ClipboardCheck,
  FileSpreadsheet,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  Settings,
  UserRoundPlus,
  Users,
  Users2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  SYSTEM_RESIDENT_INVESTORS_HREF,
  YOUR_CLIENTS_LIST_HREF,
  distributorClientDetailHref,
  distributorClientDetailTabHref,
} from "@/lib/distributor-client-routes";
import {
  buildDistManagementHubHref,
  distManagementHubTabTitle,
  resolveDistManagementHubTab,
} from "@/lib/dist-management-hub-tabs";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { buildYourClientsListHref } from "@/lib/distributor-clients-list-scope";
import { getDistributorClientProfile } from "@/lib/dummy/client-profile";
import { getBranchDistributorProfile } from "@/lib/dummy/branch-distributor-profile";
import {
  DISTRIBUTOR_OPERATIONS_DEFAULT_SECTION,
  distributorOperationsSectionHref,
  resolveDistributorOperationsSection,
} from "@/lib/distributor-operations-sections";
import {
  parseYourOperationsPathname,
  resolveDistributorOperationsVariant,
} from "@/lib/distributor-operations-variants";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export type DistributorNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  disabled?: boolean;
};

export type DistributorNavGroup = {
  id: string;
  label: string;
  items: DistributorNavItem[];
};

export const DISTRIBUTOR_DASHBOARD_ROUTE: DistributorNavItem = {
  id: "dashboard",
  label: "Dashboard",
  href: "/dashboard",
  icon: LayoutDashboard,
  description: "Zynd Mitra workspace overview",
};

export const DISTRIBUTOR_YOUR_CLIENTS_ROUTE: DistributorNavItem = {
  id: "your-clients",
  label: "Your clients",
  href: "/dashboard/your-clients",
  icon: Users,
  description: "Overview of your investor book and client lists",
};

export const DISTRIBUTOR_YOUR_OPERATIONS_ROUTE: DistributorNavItem = {
  id: "your-operations",
  label: "Your operations",
  href: distributorOperationsSectionHref(DISTRIBUTOR_OPERATIONS_DEFAULT_SECTION),
  icon: Layers3,
  description: "Overview of orders, plans, and transaction activity",
};

export const DISTRIBUTOR_PAYOUTS_ROUTE: DistributorNavItem = {
  id: "payouts",
  label: "My work",
  href: "/dashboard/payouts",
  icon: Wallet,
  description: "Salary, incentives, work time, and leave",
};

export const DISTRIBUTOR_COMPLIANCE_ROUTE: DistributorNavItem = {
  id: "compliance",
  label: "Compliance",
  href: "/dashboard/compliance",
  icon: ClipboardCheck,
  description: ZYND_MITRA_COPY.complianceQueueDesc,
};

export const DISTRIBUTOR_LEADS_ROUTE: DistributorNavItem = {
  id: "leads",
  label: "Leads",
  href: "/dashboard/leads",
  icon: UserRoundPlus,
  description: "Onboarding pipeline from invite to first investment",
};

export const DISTRIBUTOR_REPORTS_ROUTE: DistributorNavItem = {
  id: "reports",
  label: "Reports",
  href: "/dashboard/reports",
  icon: FileSpreadsheet,
  description: "Personal AUM, SIP, and commission exports",
};

export const DISTRIBUTOR_WORKSPACE_ROUTES: DistributorNavItem[] = [
  DISTRIBUTOR_DASHBOARD_ROUTE,
  DISTRIBUTOR_YOUR_CLIENTS_ROUTE,
  DISTRIBUTOR_YOUR_OPERATIONS_ROUTE,
  DISTRIBUTOR_PAYOUTS_ROUTE,
  DISTRIBUTOR_COMPLIANCE_ROUTE,
  DISTRIBUTOR_LEADS_ROUTE,
  DISTRIBUTOR_REPORTS_ROUTE,
];

export const DISTRIBUTOR_NOTIFICATIONS_ROUTE: DistributorNavItem = {
  id: "notifications",
  label: "Notifications",
  href: "/dashboard/notifications",
  icon: Bell,
  description: "Txn requests, investors, orders, and plan alerts",
};

export const DISTRIBUTOR_SETTINGS_ROUTE: DistributorNavItem = {
  id: "settings",
  label: "Settings",
  href: "/dashboard/settings",
  icon: Settings,
  description: "Account, preferences, and console settings",
};

export const DISTRIBUTOR_ALL_INVESTORS_LABEL = "All investors";

export const DISTRIBUTOR_NAV_GROUPS: DistributorNavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        id: "orders",
        label: "Orders",
        href: distributorOperationsSectionHref("orders"),
        icon: Layers3,
        description: "Lumpsum and redeem order activity",
      },
      {
        id: "systematic-plans",
        label: "Systematic Plans",
        href: "/dashboard/systematic-plans",
        icon: CalendarClock,
        description: "SIP / STP / SWP plan book",
      },
      {
        id: "txn-requests",
        label: "Txn Requests",
        href: "/dashboard/txn-requests",
        icon: ArrowLeftRight,
        description: "Pending transaction approvals",
      },
      {
        id: "transaction-groups",
        label: "Transaction Groups",
        href: "/dashboard/transaction-groups",
        icon: FolderKanban,
        description: "Grouped multi-leg transactions",
      },
    ],
  },
];

export const DISTRIBUTOR_DIST_MANAGEMENT_HUB_ROUTE: DistributorNavItem = {
  id: "dist-management-hub",
  label: "Dist management",
  href: "/dashboard/dist-management",
  icon: BarChart3,
  description: "Incentives, team performance, and branch reports",
};

export const DISTRIBUTOR_DIST_MANAGEMENT_GROUP: DistributorNavGroup = {
  id: "dist-management",
  label: "Dist management",
  items: [
    {
      id: "branch-distributors",
      label: ZYND_MITRA_COPY.plural,
      href: "/dashboard/dist-management/distributors",
      icon: Users2,
      description: ZYND_MITRA_COPY.mappedToBranch,
    },
    DISTRIBUTOR_DIST_MANAGEMENT_HUB_ROUTE,
  ],
};

export function getDistributorNavGroups(isManager: boolean): DistributorNavGroup[] {
  const groups = [...DISTRIBUTOR_NAV_GROUPS];
  if (isManager) {
    return [DISTRIBUTOR_DIST_MANAGEMENT_GROUP, ...groups];
  }
  return groups;
}

/** Standalone /dashboard/* routes that are folded into the Your operations workspace. */
export function isDistributorLegacyOperationsPath(pathname: string): boolean {
  return (
    pathname === "/dashboard/orders" ||
    pathname.startsWith("/dashboard/orders/") ||
    pathname === "/dashboard/systematic-plans" ||
    pathname.startsWith("/dashboard/systematic-plans/") ||
    pathname === "/dashboard/txn-requests" ||
    pathname.startsWith("/dashboard/txn-requests/") ||
    pathname === "/dashboard/transaction-groups" ||
    pathname.startsWith("/dashboard/transaction-groups/")
  );
}

/** Primary dashboard sidebar — flat icon rail (no section headers). */
export function getDistributorSidebarNavItems(isManager: boolean): DistributorNavItem[] {
  const groups = getDistributorNavGroups(isManager).filter((group) => group.id !== "operations");
  return [...DISTRIBUTOR_WORKSPACE_ROUTES, ...groups.flatMap((group) => group.items)];
}

export const DISTRIBUTOR_NAV_FLAT: DistributorNavItem[] = [
  ...DISTRIBUTOR_WORKSPACE_ROUTES,
  DISTRIBUTOR_NOTIFICATIONS_ROUTE,
  DISTRIBUTOR_SETTINGS_ROUTE,
  ...DISTRIBUTOR_DIST_MANAGEMENT_GROUP.items,
];

export function getDistributorNavGroup(id: string): DistributorNavGroup | undefined {
  return DISTRIBUTOR_NAV_GROUPS.find((group) => group.id === id);
}

export function isDistributorWorkspaceRouteActive(
  pathname: string,
  route: DistributorNavItem,
): boolean {
  if (route.id === "dashboard") {
    return pathname === "/dashboard";
  }
  if (route.id === "your-clients") {
    return (
      pathname === "/dashboard/your-clients" ||
      pathname.startsWith("/dashboard/your-clients/") ||
      pathname.startsWith("/dashboard/investors/resident")
    );
  }
  if (route.id === "your-operations") {
    return (
      pathname === "/dashboard/your-operations" ||
      pathname.startsWith("/dashboard/your-operations/") ||
      isDistributorLegacyOperationsPath(pathname)
    );
  }
  return isDistributorRouteActive(pathname, route.href, route.id);
}

export function isDistributorRouteActive(
  pathname: string,
  href: string,
  routeId?: string,
): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (routeId === "dist-management-hub" || href === "/dashboard/dist-management") {
    return (
      pathname === "/dashboard/dist-management" ||
      pathname === "/dashboard/dist-management/commissions" ||
      pathname === "/dashboard/dist-management/performance" ||
      pathname === "/dashboard/dist-management/reports"
    );
  }
  if (routeId === "branch-distributors" || href === "/dashboard/dist-management/distributors") {
    return pathname.startsWith("/dashboard/dist-management/distributors");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getDistributorActiveRoute(pathname: string): DistributorNavItem {
  if (isDistributorLegacyOperationsPath(pathname)) {
    return DISTRIBUTOR_YOUR_OPERATIONS_ROUTE;
  }
  if (pathname.startsWith("/dashboard/investors/resident")) {
    return DISTRIBUTOR_YOUR_CLIENTS_ROUTE;
  }
  const match = DISTRIBUTOR_NAV_FLAT.find((route) =>
    isDistributorRouteActive(pathname, route.href, route.id),
  );
  return match ?? DISTRIBUTOR_DASHBOARD_ROUTE;
}

export type DistributorBreadcrumbSegment = {
  label: string;
  href?: string;
};

export function getDistributorBreadcrumbSegments(
  pathname: string,
  searchParams?: { get(name: string): string | null },
): DistributorBreadcrumbSegment[] {
  const familyTabLabel = DISTRIBUTOR_CLIENT_COPY.tabs.family;
  if (pathname === "/dashboard") {
    return [{ label: "Dashboard" }];
  }

  if (pathname.startsWith("/dashboard/quick-transaction")) {
    return [{ label: "Quick transaction" }];
  }

  if (pathname.startsWith("/dashboard/add-investor")) {
    return [{ label: "Add investor" }];
  }

  if (pathname.startsWith("/dashboard/add-distributor")) {
    return [{ label: ZYND_MITRA_COPY.add }];
  }

  if (pathname.startsWith("/dashboard/dist-management/distributors/")) {
    const parts = pathname.split("/").filter(Boolean);
    const distributorId = parts[3];
    const profile = distributorId ? getBranchDistributorProfile(distributorId) : null;
    return [
      { label: "Dist management", href: buildDistManagementHubHref() },
      { label: ZYND_MITRA_COPY.plural, href: "/dashboard/dist-management/distributors" },
      { label: profile?.name ?? ZYND_MITRA_COPY.singular },
    ];
  }

  if (pathname === "/dashboard/dist-management/distributors") {
    return [
      { label: "Dist management", href: buildDistManagementHubHref() },
      { label: ZYND_MITRA_COPY.plural },
    ];
  }

  if (pathname.startsWith("/dashboard/dist-management")) {
    let tab = resolveDistManagementHubTab(searchParams?.get("tab"));
    if (pathname.endsWith("/commissions")) tab = "commissions";
    if (pathname.endsWith("/performance")) tab = "performance";
    if (pathname.endsWith("/reports")) tab = "reports";
    return [
      { label: "Dist management", href: buildDistManagementHubHref() },
      { label: distManagementHubTabTitle(tab) },
    ];
  }

  if (pathname.startsWith("/dashboard/notifications")) {
    return [{ label: "Notifications" }];
  }

  if (pathname.startsWith("/dashboard/payouts/payroll")) {
    return [
      { label: "My work", href: "/dashboard/payouts" },
      { label: "Payroll history" },
    ];
  }

  if (pathname.startsWith("/dashboard/payouts/leave")) {
    return [
      { label: "My work", href: "/dashboard/payouts" },
      { label: "Leave history" },
    ];
  }

  if (pathname.startsWith("/dashboard/payouts/attendance")) {
    return [
      { label: "My work", href: "/dashboard/payouts" },
      { label: "Work attendance" },
    ];
  }

  if (pathname.startsWith("/dashboard/payouts")) {
    return [{ label: "My work" }];
  }

  if (pathname.startsWith("/dashboard/compliance")) {
    return [{ label: "Compliance" }];
  }

  if (pathname.startsWith("/dashboard/leads")) {
    return [{ label: "Leads" }];
  }

  if (pathname.startsWith("/dashboard/reports")) {
    return [{ label: "Reports" }];
  }

  if (pathname.startsWith("/dashboard/settings")) {
    return [{ label: "Settings" }];
  }

  if (pathname.startsWith("/dashboard/your-clients")) {
    if (pathname === "/dashboard/your-clients") {
      return [{ label: "Your clients" }];
    }
    const parts = pathname.split("/").filter(Boolean);
    if (parts[2] === "resident" || parts[2] === "nri") {
      return [{ label: "Your clients", href: YOUR_CLIENTS_LIST_HREF }];
    }
    const clientId = parts[2];
    const groupId = parts[4];
    const isFamilyDetail = parts[3] === "family" && groupId;
    const profile = clientId ? getDistributorClientProfile(clientId) : null;
    if (isFamilyDetail && clientId && profile) {
      const group = profile.familyGroups.find((item) => item.id === groupId);
      const clientHref = distributorClientDetailHref("your-book", clientId);
      const familyHref = distributorClientDetailTabHref("your-book", clientId, "family");
      return [
        { label: "Your clients", href: YOUR_CLIENTS_LIST_HREF },
        { label: profile.displayName, href: clientHref },
        { label: familyTabLabel, href: familyHref },
        { label: group?.name ?? "Family group" },
      ];
    }
    if (clientId && profile) {
      const clientHref = distributorClientDetailHref("your-book", clientId);
      if (searchParams?.get("tab") === "family") {
        return [
          { label: "Your clients", href: YOUR_CLIENTS_LIST_HREF },
          { label: profile.displayName, href: clientHref },
          { label: familyTabLabel },
        ];
      }
      return [
        { label: "Your clients", href: YOUR_CLIENTS_LIST_HREF },
        { label: profile.displayName },
      ];
    }
    return [{ label: "Your clients" }];
  }

  if (pathname.startsWith("/dashboard/investors/resident")) {
    const allInvestorsListHref = buildYourClientsListHref("all");
    if (pathname === SYSTEM_RESIDENT_INVESTORS_HREF) {
      return [
        { label: "Your clients", href: YOUR_CLIENTS_LIST_HREF },
        { label: DISTRIBUTOR_ALL_INVESTORS_LABEL },
      ];
    }
    const parts = pathname.split("/").filter(Boolean);
    const clientId = parts[3];
    const groupId = parts[5];
    const isFamilyDetail = parts[4] === "family" && groupId;
    const profile = clientId ? getDistributorClientProfile(clientId) : null;
    if (isFamilyDetail && clientId && profile) {
      const group = profile.familyGroups.find((item) => item.id === groupId);
      const clientHref = distributorClientDetailHref("system-resident", clientId);
      const familyHref = distributorClientDetailTabHref("system-resident", clientId, "family");
      return [
        { label: "Your clients", href: YOUR_CLIENTS_LIST_HREF },
        { label: DISTRIBUTOR_ALL_INVESTORS_LABEL, href: allInvestorsListHref },
        { label: profile.displayName, href: clientHref },
        { label: familyTabLabel, href: familyHref },
        { label: group?.name ?? "Family group" },
      ];
    }
    if (clientId && profile) {
      const clientHref = distributorClientDetailHref("system-resident", clientId);
      if (searchParams?.get("tab") === "family") {
        return [
          { label: "Your clients", href: YOUR_CLIENTS_LIST_HREF },
          { label: DISTRIBUTOR_ALL_INVESTORS_LABEL, href: allInvestorsListHref },
          { label: profile.displayName, href: clientHref },
          { label: familyTabLabel },
        ];
      }
      return [
        { label: "Your clients", href: YOUR_CLIENTS_LIST_HREF },
        { label: DISTRIBUTOR_ALL_INVESTORS_LABEL, href: allInvestorsListHref },
        { label: profile.displayName },
      ];
    }
    return [
      { label: "Your clients", href: YOUR_CLIENTS_LIST_HREF },
      { label: DISTRIBUTOR_ALL_INVESTORS_LABEL },
    ];
  }

  if (pathname.startsWith("/dashboard/your-operations") || isDistributorLegacyOperationsPath(pathname)) {
    if (
      pathname === "/dashboard/your-operations" ||
      isDistributorLegacyOperationsPath(pathname)
    ) {
      return [{ label: "Your operations" }];
    }
    const { sectionId, variantId } = parseYourOperationsPathname(pathname);
    const section = sectionId ? resolveDistributorOperationsSection(sectionId) : null;
    const variant =
      sectionId && variantId
        ? resolveDistributorOperationsVariant(sectionId, variantId)
        : null;
    if (section && variant) {
      return [
        { label: "Your operations", href: "/dashboard/your-operations/orders/one-time" },
        { label: section.label },
        { label: variant.label },
      ];
    }
    if (section) {
      return [
        { label: "Your operations", href: "/dashboard/your-operations/orders/one-time" },
        { label: section.label },
      ];
    }
    return [{ label: "Your operations" }];
  }

  const route = getDistributorActiveRoute(pathname);
  const group = DISTRIBUTOR_NAV_GROUPS.find((entry) =>
    entry.items.some((item) => item.href === route.href),
  ) ?? (DISTRIBUTOR_DIST_MANAGEMENT_GROUP.items.some((item) => item.href === route.href)
    ? DISTRIBUTOR_DIST_MANAGEMENT_GROUP
    : undefined);

  if (group?.id === "operations") {
    return [
      { label: "Your operations", href: "/dashboard/your-operations" },
      { label: route.label },
    ];
  }

  if (group?.id === "dist-management") {
    return [{ label: "Dist management", href: "/dashboard/dist-management/distributors" }, { label: route.label }];
  }

  return [{ label: route.label }];
}

const INVESTOR_LIST_HREFS = new Set([
  YOUR_CLIENTS_LIST_HREF,
  buildYourClientsListHref("all"),
  SYSTEM_RESIDENT_INVESTORS_HREF,
]);

export function isInvestorListRoute(pathname: string): boolean {
  return INVESTOR_LIST_HREFS.has(pathname);
}
