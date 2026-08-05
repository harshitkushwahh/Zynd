"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type YourClientsBookMetricsSkeletonProps = {
  className?: string;
};

export function YourClientsBookMetricsSkeleton({ className }: YourClientsBookMetricsSkeletonProps) {
  return (
    <div
      className={cn("distributor-your-clients-metrics distributor-your-clients-book-metrics-skeleton", className)}
      aria-hidden
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton
          key={`tile-${index}`}
          className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__tile aspect-square w-full max-w-[var(--distributor-your-clients-metric-card-size,11rem)] rounded-[var(--radius-5xl)]"
        />
      ))}
      <Skeleton className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__ratio min-h-[var(--distributor-your-clients-metric-card-size,11rem)] rounded-[var(--radius-5xl)]" />
      <Skeleton className="distributor-your-clients-metrics__cell distributor-your-clients-metrics__summary min-h-[var(--distributor-your-clients-metric-card-size,11rem)] rounded-[var(--radius-5xl)]" />
    </div>
  );
}
