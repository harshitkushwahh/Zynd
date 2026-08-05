"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 300;

type DistributorReportsInsightTabSkeletonProps = {
  className?: string;
};

function InsightChartCardSkeleton() {
  return (
    <div className="distributor-reports-insight-chart distributor-reports-insight-chart--skeleton">
      <div className="distributor-reports-insight-chart__head">
        <Skeleton className="h-4 w-28 rounded-[var(--radius-control)]" />
        <Skeleton className="size-3.5 shrink-0 rounded-[var(--radius-sm)]" />
      </div>
      <Skeleton
        className="distributor-reports-insight-chart__plot-skeleton w-full rounded-[var(--radius-5xl)]"
        style={{ height: CHART_HEIGHT }}
      />
    </div>
  );
}

export function DistributorReportsInsightTabSkeleton({
  className,
}: DistributorReportsInsightTabSkeletonProps) {
  return (
    <div
      className={cn("distributor-reports-insight-tab-skeleton", className)}
      aria-busy="true"
      aria-label="Loading report insights"
    >
      <div className="distributor-reports-insight__content">
        <InsightChartCardSkeleton />
        <InsightChartCardSkeleton />
      </div>
    </div>
  );
}
