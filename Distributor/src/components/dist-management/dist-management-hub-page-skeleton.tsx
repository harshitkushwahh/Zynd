"use client";

import { DistributorPageHeaderSkeleton } from "@/components/dashboard/distributor-page-header-skeleton";
import { DistributorScopeTableSkeleton } from "@/components/workspace/distributor-scope-table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DISTRIBUTOR_DIST_MANAGEMENT_HUB_METRICS_CLASS,
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type DistManagementHubPageSkeletonProps = {
  className?: string;
};

export function DistManagementHubPageSkeleton({ className }: DistManagementHubPageSkeletonProps) {
  return (
    <div
      className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-scope-page--skeleton", className)}
      aria-busy="true"
      aria-label="Loading dist management"
    >
      <DistributorPageHeaderSkeleton
        className="distributor-client-detail-tabs-header"
        titleClassName="h-8 w-[min(100%,11rem)]"
        actionsClassName="h-9 w-[min(100%,22rem)] rounded-[var(--radius-full)]"
      />

      <div
        className={cn(
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
          DISTRIBUTOR_DIST_MANAGEMENT_HUB_METRICS_CLASS,
        )}
        aria-hidden
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={`hub-metric-${index}`}
            className={cn(
              DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
              "distributor-dist-management-hub-page-skeleton__metric h-full w-full rounded-[var(--radius-5xl)]",
            )}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2" aria-hidden>
        <Skeleton className="distributor-dist-management-hub-page-skeleton__chart rounded-[var(--radius-5xl)]" />
        <Skeleton className="distributor-dist-management-hub-page-skeleton__chart rounded-[var(--radius-5xl)]" />
      </div>

      <Skeleton
        className="distributor-dist-management-hub-page-skeleton__wide-chart w-full rounded-[var(--radius-5xl)]"
        aria-hidden
      />

      <div className="distributor-branch-distributor-work-subtabs" aria-hidden>
        <div className="distributor-scope-page-skeleton__header distributor-scope-page-skeleton__header--toolbar distributor-client-activity-tab__subheader">
          <Skeleton className="h-5 w-40 rounded-[var(--radius-control)]" />
          <Skeleton className="h-9 w-[min(100%,18rem)] rounded-[var(--radius-full)]" />
        </div>
        <DistributorScopeTableSkeleton ariaLabel="Loading dist management table" filterPlaceholderCount={3} />
      </div>
    </div>
  );
}
