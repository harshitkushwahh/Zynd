"use client";

import { DistributorScopeTableSkeleton } from "@/components/workspace/distributor-scope-table-skeleton";
import { YourClientsBookMetricsSkeleton } from "@/components/workspace/your-clients-book-metrics-skeleton";
import { YourOperationsSidebarSkeleton } from "@/components/workspace/your-operations-sidebar-skeleton";
import {
  DISTRIBUTOR_WORKSPACE_SPLIT_CLASS,
  DISTRIBUTOR_WORKSPACE_SPLIT_MAIN_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type YourOperationsPageSkeletonProps = {
  className?: string;
  ariaLabel?: string;
};

export function YourOperationsPageSkeleton({
  className,
  ariaLabel = "Loading operations",
}: YourOperationsPageSkeletonProps) {
  return (
    <div
      className={cn("distributor-your-operations-page-skeleton", className)}
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <YourClientsBookMetricsSkeleton className="distributor-your-operations-page-skeleton__metrics" />

      <div className={DISTRIBUTOR_WORKSPACE_SPLIT_CLASS}>
        <YourOperationsSidebarSkeleton />
        <div className={DISTRIBUTOR_WORKSPACE_SPLIT_MAIN_CLASS}>
          <DistributorScopeTableSkeleton
            ariaLabel="Loading operations table"
            filterPlaceholderCount={3}
            className="distributor-your-clients-scope-panel__layer--skeleton"
          />
        </div>
      </div>
    </div>
  );
}
