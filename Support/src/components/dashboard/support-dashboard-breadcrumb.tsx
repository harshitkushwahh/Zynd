"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useSupportPageChrome } from "@/components/dashboard/support-page-chrome-context";
import { getSupportBreadcrumbSegments } from "@/lib/support-navigation";
import { supportBreadcrumbOffsetClass } from "@/lib/support-layout";
import { cn } from "@/lib/utils";

type SupportDashboardBreadcrumbProps = {
  className?: string;
};

export function SupportDashboardBreadcrumb({ className }: SupportDashboardBreadcrumbProps) {
  const pathname = usePathname();
  const { hideBreadcrumb } = useSupportPageChrome();
  const segments = getSupportBreadcrumbSegments(pathname);

  if (hideBreadcrumb) {
    return null;
  }

  return (
    <Breadcrumb className={cn(supportBreadcrumbOffsetClass(), className)}>
      <BreadcrumbList className="h-8 flex-nowrap items-center overflow-hidden">
        <BreadcrumbItem>
          <BreadcrumbLink
            render={<Link href="/dashboard" aria-label="Support home" />}
            className="inline-flex items-center"
          >
            <Home className="size-3.5" strokeWidth={2.25} />
            <span className="sr-only">Overview</span>
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
