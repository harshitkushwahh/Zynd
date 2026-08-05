"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { DistributorReportsInsightTabSkeleton } from "@/components/reports/distributor-reports-insight-tab-skeleton";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type DistributorReportsPageSkeletonProps = {
  className?: string;
};

export function DistributorReportsPageSkeleton({ className }: DistributorReportsPageSkeletonProps) {
  return (
    <div
      className={cn(
        DISTRIBUTOR_PAGE_STACK_CLASS,
        "distributor-reports-page distributor-reports-page--skeleton",
        className,
      )}
      aria-busy="true"
      aria-label="Loading reports"
    >
      <div className="distributor-reports-page-skeleton__header">
        <Skeleton className="h-8 w-[min(100%,14rem)] max-w-full rounded-[var(--radius-control)]" />
        <Skeleton className="mt-2 h-4 w-[min(100%,24rem)] max-w-full rounded-[var(--radius-control)]" />
      </div>

      <div className="distributor-reports-hero-row distributor-reports-page-skeleton__hero">
        <div className="distributor-reports-hero-row__metrics distributor-reports-page-skeleton__metrics distributor-reports-metrics">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              className="distributor-reports-page-skeleton__metric-tile rounded-[var(--radius-5xl)]"
            />
          ))}
        </div>
        <div className="distributor-reports-hero-row__hyper">
          <Skeleton className="distributor-reports-page-skeleton__net-sales rounded-[var(--radius-5xl)]" />
        </div>
      </div>

      <section className="distributor-reports-insight distributor-reports-page-skeleton__insight">
        <div className="distributor-reports-insight__toolbar">
          <Skeleton className="h-6 w-32 rounded-[var(--radius-control)]" />
          <Skeleton className="h-9 w-[min(100%,20rem)] rounded-[var(--radius-full)]" />
        </div>
        <DistributorReportsInsightTabSkeleton />
      </section>

      <section className="distributor-report-export-library distributor-reports-page-skeleton__exports">
        <Skeleton className="h-5 w-24 rounded-[var(--radius-control)]" />
        <ul className="distributor-report-export-library__grid" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index}>
              <Skeleton className="distributor-reports-page-skeleton__template-card rounded-[var(--radius-xl)]" />
            </li>
          ))}
        </ul>
      </section>

      <div className="distributor-reports-page-skeleton__table">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 min-w-[12rem] flex-1 max-w-[16rem] rounded-[var(--radius-full)]" />
          <Skeleton className="h-10 w-32 rounded-[var(--radius-full)]" />
          <Skeleton className="h-10 w-28 rounded-[var(--radius-full)]" />
          <Skeleton className="h-9 w-16 shrink-0 rounded-[var(--radius-control)]" />
        </div>
        <Skeleton className="mt-3 h-64 w-full rounded-[var(--radius-5xl)]" />
      </div>
    </div>
  );
}
