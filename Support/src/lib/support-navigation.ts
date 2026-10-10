import {
  Banknote,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

export type SupportNavRoute = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** Optional count for nav badges (e.g. open tickets). */
  badgeCount?: number;
};

export const SUPPORT_NAV_ROUTES: SupportNavRoute[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Queue health and recent support activity",
  },
  {
    id: "tickets",
    label: "Tickets",
    href: "/dashboard/tickets",
    icon: Ticket,
    description: "Open and assigned support tickets",
    badgeCount: 12,
  },
  {
    id: "users",
    label: "Users",
    href: "/dashboard/users",
    icon: Users,
    description: "End-user directory for support lookup",
  },
  {
    id: "transactions",
    label: "Transactions",
    href: "/dashboard/transactions",
    icon: Banknote,
    description: "Investor orders, payments, and failed transactions",
  },
  {
    id: "kyc-verifications",
    label: "KYC & Verifications",
    href: "/dashboard/kyc-verifications",
    icon: ShieldCheck,
    description: "Identity checks and verification escalations",
  },
  {
    id: "activity-logs",
    label: "Activity logs",
    href: "/dashboard/activity-logs",
    icon: ScrollText,
    description: "Support agent actions and workspace activity",
  },
  {
    id: "system-logs",
    label: "System logs",
    href: "/dashboard/system-logs",
    icon: ScrollText,
    description: "Integration, webhook, and platform system events",
  },
];

export function isSupportRouteActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getSupportActiveRoute(pathname: string): SupportNavRoute {
  const match = SUPPORT_NAV_ROUTES.find((route) => isSupportRouteActive(pathname, route.href));
  return match ?? SUPPORT_NAV_ROUTES[0]!;
}

export type SupportBreadcrumbSegment = {
  label: string;
  href?: string;
};

export function getSupportBreadcrumbSegments(pathname: string): SupportBreadcrumbSegment[] {
  if (pathname === "/dashboard") {
    return [{ label: "Overview" }];
  }

  const ticketDetailMatch = pathname.match(/^\/dashboard\/tickets\/([^/]+)$/);
  if (ticketDetailMatch) {
    return [
      { label: "Tickets", href: "/dashboard/tickets" },
      { label: decodeURIComponent(ticketDetailMatch[1]!) },
    ];
  }

  const userDetailMatch = pathname.match(/^\/dashboard\/users\/([^/]+)$/);
  if (userDetailMatch) {
    return [
      { label: "Users", href: "/dashboard/users" },
      { label: decodeURIComponent(userDetailMatch[1]!) },
    ];
  }

  const active = getSupportActiveRoute(pathname);
  return [{ label: active.label }];
}
