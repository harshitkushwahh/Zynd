"use client";

import { TableCard } from "@/components/application/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DISTRIBUTOR_TABLE_FILTERS_CARD_CLASS,
  DISTRIBUTOR_YOUR_CLIENTS_SCOPE_PANEL_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

const ROW_COUNT = 8;

type DistributorScopeTableSkeletonProps = {
  className?: string;
  ariaLabel?: string;
  /** Operations tables often use two filters + search; clients may show four. */
  filterPlaceholderCount?: 3 | 4;
};

export function DistributorScopeTableSkeleton({
  className,
  ariaLabel = "Loading table",
  filterPlaceholderCount = 3,
}: DistributorScopeTableSkeletonProps) {
  return (
    <div
      className={cn(
        DISTRIBUTOR_YOUR_CLIENTS_SCOPE_PANEL_CLASS,
        "distributor-your-clients-scope-panel__layer",
        className,
      )}
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div className="distributor-table-card-shell flex w-full min-w-0 flex-col gap-3">
        <div className="distributor-table-toolbar">
          <div className={DISTRIBUTOR_TABLE_FILTERS_CARD_CLASS}>
            <div className="distributor-table-toolbar__filters">
              {Array.from({ length: filterPlaceholderCount }, (_, index) => (
                <Skeleton
                  key={index}
                  className="h-9 w-[7.5rem] rounded-[var(--radius-control)]"
                />
              ))}
            </div>
          </div>
          <div className="distributor-table-toolbar__trailing">
            <Skeleton className="h-10 w-full min-w-[12rem] max-w-[16rem] rounded-[var(--radius-control)]" />
            <Skeleton className="h-9 w-16 shrink-0 rounded-[var(--radius-control)]" />
          </div>
        </div>

        <TableCard.Root size="sm" variant="card-rows" className="w-full min-w-0">
          <div className="distributor-your-clients-scope-table-skeleton">
            <Skeleton className="distributor-your-clients-scope-table-skeleton__head h-9 w-full rounded-none" />
            <div className="distributor-your-clients-scope-table-skeleton__body">
              {Array.from({ length: ROW_COUNT }, (_, index) => (
                <div key={index} className="distributor-your-clients-scope-table-skeleton__row">
                  <Skeleton className="h-4 w-[45%] max-w-[14rem]" />
                  <Skeleton className="h-4 w-[28%] max-w-[8rem]" />
                  <Skeleton className="h-4 w-[22%] max-w-[6.5rem]" />
                  <Skeleton className="hidden h-4 w-[18%] max-w-[5rem] sm:block" />
                </div>
              ))}
            </div>
          </div>
        </TableCard.Root>
      </div>
    </div>
  );
}
