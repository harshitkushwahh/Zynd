import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarClock,
  FileText,
  FolderKanban,
  IndianRupee,
  Layers3,
  LayoutDashboard,
  Settings,
  Users,
  Users2,
  type LucideIcon,
} from "lucide-react";

import {
  SYSTEM_RESIDENT_INVESTORS_HREF,
  YOUR_CLIENTS_LIST_HREF,
} from "@/lib/distributor-client-routes";
import { getDistributorClientProfile } from "@/lib/dummy/client-profile";
import { getBranchDistributorProfile } from "@/lib/dummy/branch-distributor-profile";
import { resolveDistributorOperationsSection } from "@/lib/distributor-operations-sections";
import {
  parseYourOperationsPathname,
  resolveDistributorOperationsVariant,
} from "@/lib/distributor-operations-variants";

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
  description: "Distributor workspace overview",
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
  href: "/dashboard/your-operations",
  icon: Layers3,
  description: "Overview of orders, plans, and transaction activity",
};

export const DISTRIBUTOR_WORKSPACE_ROUTES: DistributorNavItem[] = [
  DISTRIBUTOR_DASHBOARD_ROUTE,
  DISTRIBUTOR_YOUR_CLIENTS_ROUTE,
  DISTRIBUTOR_YOUR_OPERATIONS_ROUTE,
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

export const DISTRIBUTOR_NAV_GROUPS: DistributorNavGroup[] = [
  {
    id: "investors",
    label: "Investors",
    items: [
      {
        id: "resident",
        label: "Residential",
        href: SYSTEM_RESIDENT_INVESTORS_HREF,
        icon: Users,
        description: "All resident individuals — PM and DIY",
      },
      {
        id: "nri",
        label: "Non residential",
        href: SYSTEM_RESIDENT_INVESTORS_HREF,
        icon: Users,
        description: "Non-resident individuals (coming soon)",
        disabled: true,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        id: "orders",
        label: "Orders",
        href: "/dashboard/orders",
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

export const DISTRIBUTOR_DIST_MANAGEMENT_GROUP: DistributorNavGroup = {
  id: "dist-management",
  label: "Dist management",
  items: [
    {
      id: "branch-distributors",
      label: "Distributors",
      href: "/dashboard/dist-management/distributors",
      icon: Users2,
      description: "Distributors mapped to your branch",
    },
    {
      id: "branch-commissions",
      label: "Commissions",
      href: "/dashboard/dist-management/commissions",
      icon: IndianRupee,
      description: "Branch commission accruals and payouts",
    },
    {
      id: "branch-reports",
      label: "Reports",
      href: "/dashboard/dist-management/reports",
      icon: FileText,
      description: "AUM, sales, and compliance reports for the branch",
    },
    {
      id: "branch-performance",
      label: "Team performance",
      href: "/dashboard/dist-management/performance",
      icon: BarChart3,
      description: "Targets vs actuals across distributors",
    },
  ],
};

export function getDistributorNavGroups(isManager: boolean): DistributorNavGroup[] {
  const groups = [...DISTRIBUTOR_NAV_GROUPS];
  if (isManager) {
    return [DISTRIBUTOR_DIST_MANAGEMENT_GROUP, ...groups];
  }
  return groups;
}

export const DISTRIBUTOR_NAV_FLAT: DistributorNavItem[] = [
  ...DISTRIBUTOR_WORKSPACE_ROUTES,
  DISTRIBUTOR_NOTIFICATIONS_ROUTE,
  DISTRIBUTOR_SETTINGS_ROUTE,
  ...DISTRIBUTOR_NAV_GROUPS.flatMap((group) => group.items),
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
      pathname.startsWith("/dashboard/your-clients/")
    );
  }
  if (route.id === "your-operations") {
    return (
      pathname === "/dashboard/your-operations" ||
      pathname.startsWith("/dashboard/your-operations/")
    );
  }
  return isDistributorRouteActive(pathname, route.href);
}

export function isDistributorRouteActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getDistributorActiveRoute(pathname: string): DistributorNavItem {
  const match = DISTRIBUTOR_NAV_FLAT.find((route) =>
    isDistributorRouteActive(pathname, route.href),
  );
  return match ?? DISTRIBUTOR_DASHBOARD_ROUTE;
}

export type DistributorBreadcrumbSegment = {
  label: string;
  href?: string;
};

export function getDistributorBreadcrumbSegments(
  pathname: string,
): DistributorBreadcrumbSegment[] {
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
    return [{ label: "Add distributor" }];
  }

  if (pathname.startsWith("/dashboard/dist-management/distributors/")) {
    const parts = pathname.split("/").filter(Boolean);
    const distributorId = parts[3];
    const profile = distributorId ? getBranchDistributorProfile(distributorId) : null;
    return [
      { label: "Dist management", href: "/dashboard/dist-management/distributors" },
      { label: "Distributors", href: "/dashboard/dist-management/distributors" },
      { label: profile?.name ?? "Distributor" },
    ];
  }

  if (pathname.startsWith("/dashboard/dist-management")) {
    const route = getDistributorActiveRoute(pathname);
    return [{ label: "Dist management", href: "/dashboard/dist-management/distributors" }, { label: route.label }];
  }

  if (pathname.startsWith("/dashboard/notifications")) {
    return [{ label: "Notifications" }];
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
      return [
        { label: "Your clients", href: YOUR_CLIENTS_LIST_HREF },
        {
          label: profile.displayName,
          href: `${YOUR_CLIENTS_LIST_HREF}/${clientId}`,
        },
        { label: group?.name ?? "Family group" },
      ];
    }
    if (clientId && profile) {
      return [
        { label: "Your clients", href: YOUR_CLIENTS_LIST_HREF },
        { label: profile.displayName },
      ];
    }
    return [{ label: "Your clients" }];
  }

  if (pathname.startsWith("/dashboard/investors/resident")) {
    if (pathname === SYSTEM_RESIDENT_INVESTORS_HREF) {
      return [{ label: "Residential" }];
    }
    const parts = pathname.split("/").filter(Boolean);
    const clientId = parts[3];
    const groupId = parts[5];
    const isFamilyDetail = parts[4] === "family" && groupId;
    const profile = clientId ? getDistributorClientProfile(clientId) : null;
    if (isFamilyDetail && clientId && profile) {
      const group = profile.familyGroups.find((item) => item.id === groupId);
      return [
        { label: "Residential", href: SYSTEM_RESIDENT_INVESTORS_HREF },
        {
          label: profile.displayName,
          href: `${SYSTEM_RESIDENT_INVESTORS_HREF}/${clientId}`,
        },
        { label: group?.name ?? "Family group" },
      ];
    }
    if (clientId && profile) {
      return [
        { label: "Residential", href: SYSTEM_RESIDENT_INVESTORS_HREF },
        { label: profile.displayName },
      ];
    }
    return [{ label: "Residential" }];
  }

  if (pathname.startsWith("/dashboard/your-operations")) {
    if (pathname === "/dashboard/your-operations") {
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

  if (group?.id === "investors") {
    return [{ label: "Investors", href: SYSTEM_RESIDENT_INVESTORS_HREF }, { label: route.label }];
  }

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

const INVESTOR_LIST_HREFS = new Set([SYSTEM_RESIDENT_INVESTORS_HREF]);

export function isInvestorListRoute(pathname: string): boolean {
  return INVESTOR_LIST_HREFS.has(pathname);
}
