"use client";

import { DistributorPageHeaderSkeleton } from "@/components/dashboard/distributor-page-header-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DISTRIBUTOR_CLIENT_DETAIL_TABS_ASIDE_CLASS,
  DISTRIBUTOR_CLIENT_DETAIL_TABS_BODY_CLASS,
  DISTRIBUTOR_CLIENT_DETAIL_TABS_MAIN_CLASS,
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_TABS_CONTENT_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type ClientDetailPageSkeletonProps = {
  className?: string;
};

export function ClientDetailPageSkeleton({ className }: ClientDetailPageSkeletonProps) {
  return (
    <div
      className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-client-detail-page-skeleton", className)}
      aria-busy="true"
      aria-label="Loading client profile"
    >
      <div className="distributor-client-detail-tabs-root">
        <DistributorPageHeaderSkeleton className="distributor-client-detail-tabs-header" />

        <div className={DISTRIBUTOR_CLIENT_DETAIL_TABS_BODY_CLASS}>
          <div className={DISTRIBUTOR_CLIENT_DETAIL_TABS_MAIN_CLASS}>
            <div className={DISTRIBUTOR_TABS_CONTENT_CLASS}>
              <Skeleton className="h-44 w-full rounded-[var(--radius-5xl)]" />

              <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-8 w-40 rounded-md" />
                  </div>
                  <div className="flex gap-2">
                    {Array.from({ length: 4 }, (_, index) => (
                      <Skeleton
                        key={index}
                        className="h-8 w-14 rounded-[var(--radius-full)]"
                      />
                    ))}
                  </div>
                </div>
                <Skeleton className="h-52 w-full rounded-[var(--radius-5xl)]" />
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-10 w-44 rounded-[var(--radius-5xl)]" />
                  <Skeleton className="h-10 min-w-[15rem] flex-1 max-w-[22rem] rounded-[var(--radius-5xl)]" />
                </div>
                <Skeleton className="h-64 w-full rounded-[var(--radius-5xl)]" />
              </div>
            </div>
          </div>

          <aside className={DISTRIBUTOR_CLIENT_DETAIL_TABS_ASIDE_CLASS}>
            <Skeleton className="distributor-client-detail-page-skeleton__hero w-full rounded-[var(--radius-5xl)]" />
            <Skeleton className="h-36 w-full rounded-[var(--radius-5xl)]" />
            <Skeleton className="h-32 w-full rounded-[var(--radius-5xl)]" />
          </aside>
        </div>
      </div>
    </div>
  );
}
