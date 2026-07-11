"use client";

import { usePathname } from "next/navigation";

import {
  getDashboardPageMeta,
  isDashboardRouteActive,
  resolveDashboardRoute,
  type DashboardPageMeta,
  type DashboardRoute,
} from "@/features/dashboard/navigation/dashboard-routes";

export function useDashboardRoute(): {
  pathname: string;
  activeRoute: DashboardRoute | undefined;
  pageMeta: DashboardPageMeta;
  isRouteActive: (route: DashboardRoute) => boolean;
} {
  const pathname = usePathname();
  const activeRoute = resolveDashboardRoute(pathname);
  const pageMeta = getDashboardPageMeta(pathname);

  return {
    pathname,
    activeRoute,
    pageMeta,
    isRouteActive: (route) => isDashboardRouteActive(pathname, route),
  };
}
