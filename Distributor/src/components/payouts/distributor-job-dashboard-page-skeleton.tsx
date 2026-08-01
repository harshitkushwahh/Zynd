"use client";

import { DistributorPageHeaderSkeleton } from "@/components/dashboard/distributor-page-header-skeleton";
import { DistributorScopeTableSkeleton } from "@/components/workspace/distributor-scope-table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type DistributorJobDashboardPageSkeletonProps = {
  className?: string;
};

export function DistributorJobDashboardPageSkeleton({
  className,
}: DistributorJobDashboardPageSkeletonProps) {
  return (
    <div
      className={cn(
        DISTRIBUTOR_PAGE_STACK_CLASS,
        "distributor-job-dashboard-page distributor-scope-page--skeleton",
        className,
      )}
      aria-busy="true"
      aria-label="Loading my work"
    >
      <DistributorPageHeaderSkeleton
        titleClassName="h-8 w-[min(100%,10rem)]"
        actionsClassName="h-9 w-[min(100%,10rem)] min-w-0 max-w-[10rem]"
      />

      <div
        className={cn(DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS, "distributor-job-metrics")}
        aria-hidden
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={`tile-${index}`}
            className={cn(
              DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
              "distributor-job-dashboard-page-skeleton__tile distributor-your-clients-metrics__tile w-full max-w-[var(--distributor-compliance-metric-card-width)] rounded-[var(--radius-5xl)]",
            )}
          />
        ))}
        <Skeleton
          className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__split min-h-[var(--distributor-job-dashboard-card-height,12rem)] rounded-[var(--radius-5xl)]"
        />
      </div>

      <div className="distributor-job-dashboard__widget-row" aria-hidden>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton
            key={`widget-${index}`}
            className="distributor-job-dashboard-widget rounded-[var(--radius-5xl)]"
          />
        ))}
      </div>

      <DistributorScopeTableSkeleton
        ariaLabel="Loading commission payouts table"
        filterPlaceholderCount={3}
      />
    </div>
  );
}
