"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DEFAULT_ROWS = 10;

type SupportTableSkeletonProps = {
  className?: string;
  ariaLabel?: string;
  rowCount?: number;
  /** Approximate data columns (excluding row header). */
  columnCount?: number;
  minHeightClassName?: string;
};

export function SupportTableSkeleton({
  className,
  ariaLabel = "Loading table",
  rowCount = DEFAULT_ROWS,
  columnCount = 5,
  minHeightClassName = "min-h-[22rem]",
}: SupportTableSkeletonProps) {
  return (
    <div
      className={cn("distributor-your-clients-scope-table-skeleton w-full", minHeightClassName, className)}
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <Skeleton className="distributor-your-clients-scope-table-skeleton__head h-10 w-full rounded-none" />
      <div className="distributor-your-clients-scope-table-skeleton__body">
        {Array.from({ length: rowCount }, (_, rowIndex) => (
          <div key={rowIndex} className="distributor-your-clients-scope-table-skeleton__row">
            <Skeleton className="h-4 w-[32%] max-w-[12rem]" />
            {Array.from({ length: columnCount }, (_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn(
                  "h-4",
                  colIndex === 0 ? "w-[18%] max-w-[7rem]" : "w-[14%] max-w-[6rem]",
                  colIndex >= 3 && "hidden md:block",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SupportMetricsTilesSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}
      aria-busy="true"
      aria-label="Loading metrics"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-[7.25rem] rounded-[var(--radius-5xl)]" />
      ))}
    </div>
  );
}
