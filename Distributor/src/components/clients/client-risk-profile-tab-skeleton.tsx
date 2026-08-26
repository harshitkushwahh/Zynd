"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ClientRiskProfileTabSkeletonProps = {
  className?: string;
};

export function ClientRiskProfileTabSkeleton({ className }: ClientRiskProfileTabSkeletonProps) {
  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      aria-busy="true"
      aria-label="Loading risk profile"
    >
      <div className="distributor-client-risk-top-row">
        <Skeleton className="distributor-client-risk-top-row__hero h-56 w-full rounded-[var(--radius-5xl)]" />
        <Skeleton className="distributor-client-risk-top-row__trends h-56 w-full rounded-[var(--radius-5xl)]" />
      </div>
      <Skeleton className="h-64 w-full rounded-[var(--radius-5xl)]" />
    </div>
  );
}
