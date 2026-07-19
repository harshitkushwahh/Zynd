"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const quickLinkRoutes = DASHBOARD_ROUTES.filter(
  (route) => route.enabled && route.id !== "portfolio-overview" && !route.disabled,
);

export function OverviewQuickLinks() {
  const { overview } = copy.dashboard;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{overview.quickLinksTitle}</CardTitle>
        <CardDescription>{overview.quickLinksDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickLinkRoutes.map((route) => {
            const Icon = route.icon;

            return (
              <Link
                key={route.id}
                href={route.href}
                className={cn(
                  "group flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-muted/15 p-4",
                  "transition-colors hover:border-primary/30 hover:bg-muted/30",
                )}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
                  <Icon className="size-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{route.label}</p>
                  <p className="mt-1 line-clamp-2 text-caption text-muted-foreground">
                    {route.description}
                  </p>
                </div>
                <ChevronRight
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
