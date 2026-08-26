import type { ReactNode } from "react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PortfolioOverviewSkeleton } from "@/features/dashboard/portfolio/components/portfolio-overview-skeleton";
import { PORTFOLIO_PAGE_ICON } from "@/features/dashboard/portfolio/lib/portfolio-page-tab-meta";
import { copy } from "@/shared/config/copy";

function PortfolioPageTabsSkeleton() {
  return (
    <div
      className="flex flex-wrap justify-end gap-1 rounded-full border border-border/80 bg-muted/20 p-1"
      aria-hidden="true"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-[5.5rem] rounded-full" />
      ))}
    </div>
  );
}

export function PortfolioPageLoadingView() {
  const portfolioCopy = copy.dashboard.portfolio;

  return (
    <div className="w-full min-w-0 space-y-6 pb-8">
      <DashboardBreadcrumb items={[{ label: portfolioCopy.pageTitle }]} separator="slash" />

      <PageHeader
        icon={PORTFOLIO_PAGE_ICON}
        title={portfolioCopy.pageTitle}
        loading
        action={<PortfolioPageTabsSkeleton />}
      />

      <PortfolioOverviewSkeleton />
    </div>
  );
}

export function PortfolioContentFade({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <DashboardContentFade className={className}>{children}</DashboardContentFade>;
}
