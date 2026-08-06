"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { OverviewPortfolioFlowCardSkeleton } from "@/features/dashboard/overview/components/overview-portfolio-flow-card";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

function StatCardSkeleton() {
  return (
    <div
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "min-w-0 border border-border/60 bg-card p-4 shadow-zynd-low",
      )}
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-28" />
    </div>
  );
}

function StatCardSkeletonWithSub() {
  return (
    <div
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "min-w-0 border border-border/60 bg-card p-4 shadow-zynd-low",
      )}
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-24" />
      <Skeleton className="mt-1 h-3 w-16" />
    </div>
  );
}

function AllocationPanelSkeleton() {
  return (
    <div
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "flex min-h-[13.5rem] flex-col border border-border/60 bg-card p-4 shadow-zynd-low",
      )}
    >
      <Skeleton className="h-4 w-28" />
      <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-4">
        <Skeleton className="size-28 rounded-full" />
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function HoldingsTableSkeleton() {
  return (
    <div
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "mt-4 overflow-hidden border border-border/60 bg-card shadow-zynd-low",
      )}
    >
      <div className="border-b border-border/60 px-4 py-3.5 md:px-5">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-4 md:px-5">
            <Skeleton className="size-8 shrink-0 rounded-[var(--radius-control)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5 max-w-xs" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden h-4 w-14 sm:block" />
            <Skeleton className="hidden h-4 w-12 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortfolioOverviewSkeleton() {
  return (
    <div aria-busy="true" aria-hidden="true">
      <div className="grid gap-3 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)] lg:items-stretch">
        <div className="flex flex-col gap-3 lg:content-start">
          <StatCardSkeleton />
          <StatCardSkeletonWithSub />
          <div className="grid grid-cols-2 gap-3">
            <StatCardSkeleton />
            <StatCardSkeletonWithSub />
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-stretch">
          <OverviewPortfolioFlowCardSkeleton className="shadow-zynd-low" />
          <AllocationPanelSkeleton />
        </div>
      </div>

      <HoldingsTableSkeleton />
    </div>
  );
}
