"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type ClientFamilyGroupPageSkeletonProps = {
  className?: string;
};

export function ClientFamilyGroupPageSkeleton({ className }: ClientFamilyGroupPageSkeletonProps) {
  return (
    <div
      className={cn("distributor-family-group-dashboard distributor-family-group-page-skeleton", className)}
      aria-busy="true"
      aria-label="Loading family group"
    >
      <div
        className={cn(
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_CLASS,
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
          "distributor-family-group-dashboard__hero-row",
        )}
      >
        <Skeleton className="distributor-family-group-page-skeleton__identity min-h-[10rem] w-full rounded-[var(--radius-5xl)]" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton
            key={index}
            className={cn(
              DISTRIBUTOR_METRIC_TILE_CELL_CLASS,
              "distributor-family-group-dashboard__metric-tile aspect-square w-full max-w-[var(--distributor-your-clients-metric-card-size,11rem)] rounded-[var(--radius-5xl)]",
            )}
          />
        ))}
      </div>

      <div className="distributor-family-group-dashboard__main">
        <Skeleton className="h-72 w-full rounded-[var(--radius-5xl)]" />
        <Skeleton className="h-56 w-full rounded-[var(--radius-5xl)]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-[var(--radius-5xl)]" />
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-md rounded-[var(--radius-5xl)]" />
        <Skeleton className="h-72 w-full rounded-[var(--radius-5xl)]" />
      </div>
    </div>
  );
}
