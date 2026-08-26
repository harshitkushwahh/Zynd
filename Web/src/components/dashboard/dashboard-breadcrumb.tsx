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
  onClick?: () => void;
};

type DashboardBreadcrumbProps = {
  items: DashboardBreadcrumbItem[];
  className?: string;
  separator?: "chevron" | "slash";
};

export function DashboardBreadcrumb({
  items,
  className,
  separator = "chevron",
}: DashboardBreadcrumbProps) {
  const separatorNode =
    separator === "slash" ? (
      <span className="text-muted-foreground/70">/</span>
    ) : undefined;

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
              <BreadcrumbSeparator>{separatorNode}</BreadcrumbSeparator>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : item.onClick ? (
                  <BreadcrumbLink
                    render={
                      <button type="button" onClick={item.onClick} />
                    }
                  >
                    {item.label}
                  </BreadcrumbLink>
                ) : item.href ? (
                  <BreadcrumbLink render={<Link href={item.href} />}>{item.label}</BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
