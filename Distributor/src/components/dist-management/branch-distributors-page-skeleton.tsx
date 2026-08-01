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
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type BranchDistributorsPageSkeletonProps = {
  className?: string;
};

export function BranchDistributorsPageSkeleton({ className }: BranchDistributorsPageSkeletonProps) {
  return (
    <div
      className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-scope-page--skeleton", className)}
      aria-busy="true"
      aria-label={ZYND_MITRA_COPY.loading}
    >
      <DistributorPageHeaderSkeleton
        showActions={false}
        titleClassName="h-8 w-[min(100%,11rem)]"
      />

      <div
        className={cn(
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
          "distributor-branch-distributors-metrics",
        )}
        aria-hidden
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={`distributor-metric-${index}`}
            className={cn(
              DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
              "distributor-branch-distributors-page-skeleton__tile aspect-square w-full max-w-[var(--distributor-your-clients-metric-card-size,11rem)] rounded-[var(--radius-5xl)]",
            )}
          />
        ))}
        <Skeleton className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__summary distributor-branch-distributors-page-skeleton__summary min-h-[var(--distributor-your-clients-metric-card-size,11rem)] rounded-[var(--radius-5xl)]" />
      </div>

      <DistributorScopeTableSkeleton
        ariaLabel={ZYND_MITRA_COPY.loadingTable}
        filterPlaceholderCount={3}
      />
    </div>
  );
}
