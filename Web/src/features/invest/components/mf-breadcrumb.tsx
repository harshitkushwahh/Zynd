"use client";

import {
  DashboardBreadcrumb,
  type DashboardBreadcrumbItem,
} from "@/components/dashboard/dashboard-breadcrumb";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";

const mutualFundsRoute =
  DASHBOARD_ROUTES.find((route) => route.id === "mutual-funds") ?? null;

export type MfBreadcrumbItem = DashboardBreadcrumbItem;

type MfBreadcrumbProps = {
  trail?: MfBreadcrumbItem[];
  className?: string;
};

function buildMutualFundsBreadcrumbItems(trail: MfBreadcrumbItem[] = []): DashboardBreadcrumbItem[] {
  const mutualFundsLabel = mutualFundsRoute?.label ?? "Mutual Funds";
  const mutualFundsHref = mutualFundsRoute?.href ?? "/dashboard/mutual-funds";

  if (trail.length === 0) {
    return [{ label: mutualFundsLabel }];
  }

  return [{ label: mutualFundsLabel, href: mutualFundsHref }, ...trail];
}

export function MfBreadcrumb({ trail = [], className }: MfBreadcrumbProps) {
  return (
    <DashboardBreadcrumb items={buildMutualFundsBreadcrumbItems(trail)} className={className} />
  );
}
