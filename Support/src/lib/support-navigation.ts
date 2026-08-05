import {
  LayoutDashboard,
  ScrollText,
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
  },
  {
    id: "users",
    label: "Users",
    href: "/dashboard/users",
    icon: Users,
    description: "End-user directory for support lookup",
  },
  {
    id: "audit-logs",
    label: "Audit logs",
    href: "/dashboard/audit-logs",
    icon: ScrollText,
    description: "Agent actions and system audit trail",
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
