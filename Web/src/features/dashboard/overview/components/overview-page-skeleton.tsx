"use client";

import { OverviewHoldingsCardSkeleton } from "@/features/dashboard/overview/components/overview-holdings-card";
import { OverviewPortfolioFlowCardSkeleton } from "@/features/dashboard/overview/components/overview-portfolio-flow-card";
import { OverviewProfileCardSkeleton } from "@/features/dashboard/overview/components/overview-profile-card";
import { OverviewRiskCardSkeleton } from "@/features/dashboard/overview/components/overview-risk-card";
import { OverviewFamilyCardSkeleton } from "@/features/dashboard/overview/components/overview-family-circles";
import { OverviewSipsCardSkeleton } from "@/features/dashboard/overview/components/overview-sips-card";
import { OverviewRecentTransactionsSkeleton } from "@/features/dashboard/overview/components/overview-recent-transactions";
import { OverviewGoalsCardSkeleton } from "@/features/dashboard/overview/components/overview-goals-card";
import { Skeleton } from "@/components/ui/skeleton";

export function OverviewPageSkeleton() {
  return (
    <div className="w-full min-w-0" aria-busy="true" aria-live="polite">
      <div className="mb-4">
        <Skeleton className="h-7 w-56 max-w-full" />
      </div>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
        <OverviewProfileCardSkeleton className="shrink-0" />
        <OverviewPortfolioFlowCardSkeleton className="min-w-0 flex-1 lg:min-w-[27rem]" />
        <OverviewHoldingsCardSkeleton className="min-w-0 lg:w-[17rem] lg:shrink-0 xl:w-[18rem]" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,1.15fr)] xl:items-stretch">
        <div className="grid grid-cols-[minmax(9rem,10.5rem)_minmax(0,1fr)] gap-3 sm:gap-4">
          <OverviewRiskCardSkeleton />
          <OverviewSipsCardSkeleton />
        </div>

        <OverviewGoalsCardSkeleton className="min-w-0" />

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:items-stretch xl:col-span-2">
          <OverviewFamilyCardSkeleton />

          <OverviewRecentTransactionsSkeleton className="min-w-0" />
        </div>
      </div>
    </div>
  );
}
