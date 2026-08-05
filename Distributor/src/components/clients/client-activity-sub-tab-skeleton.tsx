"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type ClientActivitySubTabSkeletonProps = {
  className?: string;
};

export function ClientActivitySubTabSkeleton({ className }: ClientActivitySubTabSkeletonProps) {
  return (
    <div
      className={cn("distributor-client-activity-sub-tab-skeleton", className)}
      aria-busy="true"
      aria-label="Loading activity"
    >
      <div
        className={cn(
          DISTRIBUTOR_YOUR_CLIENTS_METRICS_TILES_ONLY_CLASS,
          "distributor-client-activity-tab__metrics-row",
        )}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={index}
            className="distributor-your-clients-metrics__tile aspect-square w-full max-w-[var(--distributor-your-clients-metric-card-size,11rem)] rounded-[var(--radius-5xl)]"
          />
        ))}
      </div>

      <div className="distributor-client-activity-tab__filters-row">
        <div className="flex w-full flex-wrap items-center gap-2">
          <Skeleton className="h-10 min-w-[12rem] flex-1 max-w-[16rem] rounded-[var(--radius-full)]" />
          <Skeleton className="h-10 w-44 rounded-[var(--radius-full)]" />
          <Skeleton className="h-9 w-16 shrink-0 rounded-[var(--radius-control)]" />
        </div>
      </div>

      <Skeleton className="h-72 w-full rounded-[var(--radius-5xl)]" />
    </div>
  );
}
