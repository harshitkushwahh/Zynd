"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DistributorDashboardSkeletonProps = {
  className?: string;
};

export function DistributorDashboardSkeleton({ className }: DistributorDashboardSkeletonProps) {
  return (
    <div
      className={cn("distributor-dashboard-page distributor-dashboard-page--skeleton", className)}
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="distributor-dashboard-page__greeting">
        <Skeleton className="h-8 w-[min(100%,18rem)] max-w-full rounded-[var(--radius-control)]" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-28 rounded-[var(--radius-control)]" />
          <Skeleton className="h-9 w-32 rounded-[var(--radius-control)]" />
        </div>
      </div>

      <div className="distributor-dashboard-page__payout">
        <div className="distributor-salaries-incentive distributor-dashboard-skeleton__payout">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="mt-2 h-7 w-40 rounded-md" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-[70%] max-w-[12rem]" />
                  <Skeleton className="h-3 w-[90%] max-w-[16rem]" />
                </div>
                <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="distributor-dashboard-page__body">
        <div className="distributor-dashboard-top">
          <div className="distributor-dashboard-top__profile">
            <Skeleton className="distributor-dashboard-skeleton__profile h-full min-h-[var(--distributor-dashboard-card-height,12rem)] w-full rounded-[var(--radius-5xl)]" />
          </div>
          <div className="distributor-dashboard-top__insights">
            <Skeleton className="distributor-dashboard-skeleton__insights h-full min-h-[var(--distributor-dashboard-card-height,12rem)] w-full rounded-[var(--radius-5xl)]" />
          </div>
        </div>

        <div className="distributor-dashboard-operations distributor-dashboard-skeleton__operations">
          <div className="distributor-dashboard-operations-row">
            <div className="distributor-dashboard-operations__grid">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton
                  key={index}
                  className="distributor-dashboard-skeleton__ops-tile aspect-square w-full max-w-[var(--distributor-your-clients-metric-card-size,11rem)] rounded-[var(--radius-5xl)]"
                />
              ))}
            </div>
            <div className="distributor-dashboard-operations-insights">
              <Skeleton className="distributor-dashboard-skeleton__chart h-[var(--distributor-dashboard-card-height,12rem)] w-full min-w-[var(--distributor-dashboard-operations-chart-min-width,17rem)] rounded-[var(--radius-5xl)]" />
              <Skeleton className="distributor-dashboard-skeleton__chart h-[var(--distributor-dashboard-card-height,12rem)] w-full min-w-[var(--distributor-dashboard-operations-chart-min-width,17rem)] rounded-[var(--radius-5xl)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
