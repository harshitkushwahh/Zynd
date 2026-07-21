"use client";

import Link from "next/link";
import { Home } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type DashboardBreadcrumbItem = {
  label: string;
  href?: string;
};

type DashboardBreadcrumbProps = {
  items: DashboardBreadcrumbItem[];
  className?: string;
};

export function DashboardBreadcrumb({ items, className }: DashboardBreadcrumbProps) {
  return (
    <Breadcrumb className={cn("mb-6 shrink-0", className)}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            render={<Link href="/dashboard" aria-label="Dashboard" />}
            className="inline-flex items-center"
          >
            <Home className="size-3.5" strokeWidth={2.25} />
            <span className="sr-only">Dashboard</span>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <span key={`${item.label}-${index}`} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={item.href} />}>{item.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
