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

type DistributorCompliancePageSkeletonProps = {
  className?: string;
};

export function DistributorCompliancePageSkeleton({
  className,
}: DistributorCompliancePageSkeletonProps) {
  return (
    <div
      className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-scope-page--skeleton", className)}
      aria-busy="true"
      aria-label="Loading compliance"
    >
      <DistributorPageHeaderSkeleton
        showActions={false}
        titleClassName="h-8 w-[min(100%,12rem)]"
      />

      <div
        className={cn(DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS, "distributor-compliance-metrics")}
        aria-hidden
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={`tile-${index}`}
            className={cn(
              DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
              "distributor-compliance-page-skeleton__tile distributor-your-clients-metrics__tile w-full max-w-[var(--distributor-compliance-metric-card-width)] rounded-[var(--radius-5xl)]",
            )}
          />
        ))}
        <Skeleton className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__resolution min-h-[var(--distributor-your-clients-metric-card-size,11rem)] rounded-[var(--radius-5xl)]" />
      </div>

      <DistributorScopeTableSkeleton
        ariaLabel="Loading compliance table"
        filterPlaceholderCount={3}
      />
    </div>
  );
}
