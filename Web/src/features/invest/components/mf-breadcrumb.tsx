"use client";

import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";

const mutualFundsRoute =
  DASHBOARD_ROUTES.find((route) => route.id === "mutual-funds") ?? null;

export type MfBreadcrumbItem = {
  label: string;
  href?: string;
};

type MfBreadcrumbProps = {
  trail?: MfBreadcrumbItem[];
};

export function MfBreadcrumb({ trail = [] }: MfBreadcrumbProps) {
  const mutualFundsLabel = mutualFundsRoute?.label ?? "Mutual Funds";
  const mutualFundsHref = mutualFundsRoute?.href ?? "/dashboard/mutual-funds";

  return (
    <Breadcrumb className="mb-6 shrink-0">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/dashboard" />}>Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {trail.length === 0 ? (
          <BreadcrumbItem>
            <BreadcrumbPage>{mutualFundsLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={mutualFundsHref} />}>
                {mutualFundsLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {trail.map((item, index) => {
              const isLast = index === trail.length - 1;
              return (
                <span key={`${item.label}-${index}`} className="contents">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast || !item.href ? (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={item.href} />}>
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
