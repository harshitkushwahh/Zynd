"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getDistributorBreadcrumbSegments } from "@/lib/distributor-navigation";
import { distributorBreadcrumbOffsetClass } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type DistributorDashboardBreadcrumbProps = {
  className?: string;
};

export function DistributorDashboardBreadcrumb({
  className,
}: DistributorDashboardBreadcrumbProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = getDistributorBreadcrumbSegments(pathname, searchParams);

  return (
    <Breadcrumb className={cn(distributorBreadcrumbOffsetClass(), className)}>
      <BreadcrumbList className="h-8 flex-nowrap items-center overflow-hidden">
        <BreadcrumbItem>
          <BreadcrumbLink
            render={<Link href="/dashboard" aria-label="Dashboard home" />}
            className="inline-flex items-center"
          >
            <Home className="size-3.5" strokeWidth={2.25} />
            <span className="sr-only">Dashboard</span>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;

          return (
            <span key={`${segment.label}-${index}`} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast || !segment.href ? (
                  <BreadcrumbPage className="truncate">{segment.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={segment.href} />} className="truncate">
                    {segment.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
