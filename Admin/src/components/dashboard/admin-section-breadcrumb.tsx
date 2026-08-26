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
import { ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";

const overviewRoute = ADMIN_NAV_ROUTES.find((route) => route.id === "overview") ?? null;

export type AdminBreadcrumbSegment = {
  label: string;
  href?: string;
};

type AdminSectionBreadcrumbProps = {
  segments: AdminBreadcrumbSegment[];
  className?: string;
};

export function AdminSectionBreadcrumb({ segments, className }: AdminSectionBreadcrumbProps) {
  const overviewLabel = overviewRoute?.label ?? "Overview";
  const overviewHref = overviewRoute?.href ?? "/dashboard";

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href={overviewHref} />}>{overviewLabel}</BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const isPage = isLast || !segment.href;

          return (
            <span key={`${segment.label}-${index}`} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isPage ? (
                  <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={segment.href!} />}>{segment.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function userManagementBreadcrumbSegments(
  trail: AdminBreadcrumbSegment[] = [],
): AdminBreadcrumbSegment[] {
  if (trail.length === 0) {
    return [{ label: "User management" }];
  }

  return [{ label: "User management", href: "/dashboard/users" }, ...trail];
}
