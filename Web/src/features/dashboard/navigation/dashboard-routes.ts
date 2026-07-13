import {
  ArrowLeftRight,
  Bell,
  Gift,
  Landmark,
  LayoutDashboard,
  PieChart,
  Settings,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import { copy } from "@/shared/config/copy";

export type DashboardRoute = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  enabled: boolean;
  /** When false, hidden from the top header nav only (sidebar/mobile keep the link). */
  showInTopNav?: boolean;
};

export type DashboardPageMeta = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const DASHBOARD_ROUTES: DashboardRoute[] = [
  {
    id: "portfolio-overview",
    label: "Portfolio Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    description:
      "See your total wealth, asset allocation, and recent performance across all holdings.",
    enabled: true,
  },
  {
    id: "fixed-deposits",
    label: "Fixed Deposits",
    href: "/dashboard/fixed-deposits",
    icon: Landmark,
    description:
      "Track fixed deposit investments, maturity dates, and interest earned in one place.",
    enabled: true,
  },
  {
    id: "mutual-funds",
    label: "Mutual Funds",
    href: "/dashboard/mutual-funds",
    icon: PieChart,
    description: "Monitor mutual fund holdings, NAV changes, and portfolio distribution.",
    enabled: true,
  },
  {
    id: "transactions",
    label: "Transactions",
    href: "/dashboard/transactions",
    icon: ArrowLeftRight,
    description:
      "Review deposits, withdrawals, and investment activity across your account.",
    enabled: true,
  },
  {
    id: "referral",
    label: "Referrals",
    href: "/dashboard/referral",
    icon: Gift,
    description: copy.referral.pageDescription,
    enabled: true,
    showInTopNav: false,
  },
];

export const SETTINGS_PAGE_META: DashboardPageMeta = {
  title: "Settings",
  description:
    "Manage your profile, MFA, passwords, email, active devices, and account deletion preferences.",
  icon: Settings,
};

export const NOTIFICATIONS_PAGE_META: DashboardPageMeta = {
  title: "Notifications",
  description: "View your full notification history and unread account updates.",
  icon: Bell,
};

export const DEFAULT_DASHBOARD_HREF = DASHBOARD_ROUTES[0].href;

/** @deprecated Use `DASHBOARD_ROUTES` */
export const DASHBOARD_TABS = DASHBOARD_ROUTES.map(({ id, label }) => ({ id, label }));

/** @deprecated Use `DEFAULT_DASHBOARD_HREF` */
export const DEFAULT_DASHBOARD_SECTION = DASHBOARD_ROUTES[0].id;

/** @deprecated Use `DASHBOARD_ROUTES` */
export const DASHBOARD_NAV = DASHBOARD_ROUTES.filter((route) => route.enabled);

export function isDashboardRouteActive(pathname: string, route: DashboardRoute): boolean {
  if (route.href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}

export function resolveDashboardRoute(pathname: string): DashboardRoute | undefined {
  if (
    pathname.startsWith("/dashboard/settings") ||
    pathname.startsWith("/dashboard/kyc") ||
    pathname.startsWith("/dashboard/notifications")
  ) {
    return undefined;
  }

  const exact = DASHBOARD_ROUTES.find((route) => route.href === pathname);
  if (exact) {
    return exact;
  }

  return DASHBOARD_ROUTES.find(
    (route) => route.href !== "/dashboard" && pathname.startsWith(route.href)
  );
}

export function getDashboardPageMeta(pathname: string): DashboardPageMeta {
  if (pathname.startsWith("/dashboard/settings")) {
    return SETTINGS_PAGE_META;
  }

  if (pathname.startsWith("/dashboard/notifications")) {
    return NOTIFICATIONS_PAGE_META;
  }

  if (pathname.startsWith("/dashboard/referral/leaderboard")) {
    return {
      title: copy.referral.leaderboardPageTitle,
      description: copy.referral.leaderboardPageDescription,
      icon: Trophy,
    };
  }

  if (pathname.startsWith("/dashboard/referral/referrals")) {
    return {
      title: copy.referral.referralsPageTitle,
      description: copy.referral.referralsPageDescription,
      icon: Users,
    };
  }

  const route = resolveDashboardRoute(pathname);
  if (route) {
    return {
      title: route.label,
      description: route.description,
      icon: route.icon,
    };
  }

  if (pathname.startsWith("/dashboard/mutual-funds/all")) {
    return {
      title: "All Mutual Funds",
      description: "Browse and filter every active mutual fund in the Zynd catalog.",
      icon: PieChart,
    };
  }

  if (pathname.startsWith("/dashboard/mutual-funds/funds/")) {
    return {
      title: "Fund details",
      description: "View NAV, returns, and investment details for a mutual fund scheme.",
      icon: PieChart,
    };
  }

  if (pathname.startsWith("/dashboard/mutual-funds/category/")) {
    return {
      title: "Browse funds",
      description: "Explore mutual fund schemes in this investment category.",
      icon: PieChart,
    };
  }

  return {
    title: "Dashboard",
    description: copy.dashboard.defaultDescription,
    icon: LayoutDashboard,
  };
}

export const DASHBOARD_PAGE_META: Record<string, DashboardPageMeta> = Object.fromEntries(
  DASHBOARD_ROUTES.map((route) => [
    route.id,
    {
      title: route.label,
      description: route.description,
      icon: route.icon,
    },
  ])
);
