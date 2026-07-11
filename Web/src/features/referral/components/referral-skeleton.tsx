import { Skeleton } from "@/components/ui/skeleton";
import {
  REFERRAL_CARD_RADIUS_CLASS,
  REFERRAL_LEFT_COLUMN_CLASS,
  REFERRAL_RIGHT_COLUMN_CLASS,
} from "@/features/referral/lib/referral-ui";
import { cn } from "@/lib/utils";

function ReferralBreadcrumbSkeleton({ depth = 2 }: { depth?: 2 | 3 }) {
  return (
    <div className="mb-6 flex shrink-0 items-center gap-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="size-3.5 rounded-full" />
      <Skeleton className="h-4 w-16" />
      {depth === 3 ? (
        <>
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </>
      ) : null}
    </div>
  );
}

function ReferralPageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>
      <Skeleton className="h-9 w-full min-w-[9.5rem] sm:w-[10.5rem]" />
    </div>
  );
}

function ReferralSummaryStatCardsSkeleton() {
  return (
    <div className="grid w-full min-w-0 grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "relative min-w-0 overflow-hidden border border-border bg-card p-3 sm:p-4",
            REFERRAL_CARD_RADIUS_CLASS
          )}
        >
          <Skeleton className="absolute right-2 top-1/2 size-14 -translate-y-1/2 rounded-full sm:size-16" />
          <div className="relative z-10 space-y-2 pr-10">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReferralListRowSkeleton() {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border border-border/70 bg-muted/10 px-3 py-3 sm:px-4",
        REFERRAL_CARD_RADIUS_CLASS
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40 max-w-full" />
        </div>
      </div>
      <Skeleton className="size-10 shrink-0 rounded-full" />
    </div>
  );
}

function ReferralShareHeroCardSkeleton() {
  return (
    <div
      className={cn(
        "min-h-[18rem] border border-border bg-muted/30 p-5 sm:min-h-[19rem] sm:p-6",
        REFERRAL_CARD_RADIUS_CLASS
      )}
    >
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="mt-6 h-10 w-full" />
        <div className="flex flex-wrap gap-2 pt-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="size-8 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}

function ReferralLeaderboardPreviewCardSkeleton() {
  return (
    <div className={cn("border border-border bg-card p-3 sm:p-4", REFERRAL_CARD_RADIUS_CLASS)}>
      <Skeleton className="h-4 w-36" />
      <div className="mt-4 flex items-center gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="size-9 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-9 w-full" />
    </div>
  );
}

function ReferralHowItWorksCardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Skeleton className={cn("col-span-1 min-h-[220px] lg:col-span-2 lg:min-h-[200px]", REFERRAL_CARD_RADIUS_CLASS)} />
      <Skeleton className={cn("col-span-1 min-h-[220px] lg:min-h-[200px]", REFERRAL_CARD_RADIUS_CLASS)} />
      <Skeleton className={cn("col-span-1 min-h-[140px] lg:col-span-3 lg:min-h-[128px]", REFERRAL_CARD_RADIUS_CLASS)} />
    </div>
  );
}

function ReferralEarningsOverviewCardSkeleton() {
  return (
    <div className={cn("border border-border bg-card p-4 sm:p-5", REFERRAL_CARD_RADIUS_CLASS)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-8 w-[8.5rem]" />
      </div>
      <Skeleton className="mt-5 h-[11rem] w-full sm:h-[12rem]" />
    </div>
  );
}

function ReferralYourReferralsCardSkeleton() {
  return (
    <div className={cn("flex min-h-0 flex-col border border-border bg-card p-4 sm:p-5", REFERRAL_CARD_RADIUS_CLASS)}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <ReferralListRowSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function ReferralLeaderboardPodiumSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end md:gap-4">
      {[268, 300, 268].map((height, index) => (
        <div
          key={index}
          className={cn(
            "flex flex-col items-center border border-border bg-card px-4 pb-7 pt-10",
            REFERRAL_CARD_RADIUS_CLASS,
            index === 1 ? "md:-mt-3" : ""
          )}
          style={{ minHeight: height }}
        >
          <Skeleton className={cn("rounded-full", index === 1 ? "size-20 sm:size-[5.5rem]" : "size-16 sm:size-[4.5rem]")} />
          <Skeleton className="mt-3 h-4 w-24" />
          <Skeleton className="mt-2 h-3 w-16" />
          <Skeleton className="mt-auto h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

function ReferralLeaderboardTableSkeleton() {
  return (
    <div className={cn("overflow-hidden border border-border bg-card", REFERRAL_CARD_RADIUS_CLASS)}>
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="hidden border-b border-border px-4 py-3 sm:grid sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-16" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="h-4 w-6 shrink-0" />
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="ml-auto hidden h-4 w-12 sm:block" />
            <Skeleton className="hidden h-4 w-16 sm:block" />
            <Skeleton className="hidden h-4 w-14 sm:block" />
          </div>
        ))}
      </div>
      <div className="flex justify-center border-t border-border px-4 py-3">
        <Skeleton className="h-8 w-48" />
      </div>
    </div>
  );
}

function ReferralLeaderboardSidebarSkeleton() {
  return (
    <aside className="flex flex-col gap-4">
      <div className={cn("border border-border bg-card p-4 sm:p-5", REFERRAL_CARD_RADIUS_CLASS)}>
        <div className="flex items-start gap-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[80%]" />
          </div>
        </div>
        <div className="mt-4 space-y-0 rounded-[var(--radius-control)] border border-border/70 bg-muted/10 px-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4 py-3.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-9 w-full" />
      </div>

      <div className={cn("border border-border bg-card p-4 sm:p-5", REFERRAL_CARD_RADIUS_CLASS)}>
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 flex flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <ReferralListRowSkeleton key={index} />
          ))}
        </div>
      </div>
    </aside>
  );
}

export function ReferralDashboardSkeleton() {
  return (
    <>
      <ReferralBreadcrumbSkeleton depth={2} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <div className={REFERRAL_LEFT_COLUMN_CLASS}>
          <ReferralShareHeroCardSkeleton />
          <ReferralLeaderboardPreviewCardSkeleton />
          <ReferralHowItWorksCardSkeleton />
        </div>
        <div className={REFERRAL_RIGHT_COLUMN_CLASS}>
          <ReferralSummaryStatCardsSkeleton />
          <ReferralEarningsOverviewCardSkeleton />
          <ReferralYourReferralsCardSkeleton />
        </div>
      </div>
    </>
  );
}

export function ReferralLeaderboardSkeleton() {
  return (
    <>
      <ReferralBreadcrumbSkeleton depth={3} />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-5">
          <ReferralPageHeaderSkeleton />
          <ReferralLeaderboardPodiumSkeleton />
          <ReferralLeaderboardTableSkeleton />
        </div>
        <div className="w-full shrink-0 xl:w-[21rem]">
          <ReferralLeaderboardSidebarSkeleton />
        </div>
      </div>
    </>
  );
}

export function ReferralYourReferralsSkeleton() {
  return (
    <>
      <ReferralBreadcrumbSkeleton depth={3} />
      <div className="space-y-5">
        <ReferralPageHeaderSkeleton />
        <ReferralSummaryStatCardsSkeleton />
        <section className={cn("border border-border bg-card p-4 sm:p-5", REFERRAL_CARD_RADIUS_CLASS)}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Skeleton className="h-4 w-28" />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Skeleton className="h-8 w-full sm:w-[15rem]" />
              <Skeleton className="h-8 w-full min-w-[10.5rem] sm:w-[11.5rem]" />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {Array.from({ length: 8 }).map((_, index) => (
              <ReferralListRowSkeleton key={index} />
            ))}
          </div>
          <div className="mt-4 flex justify-center pt-2">
            <Skeleton className="h-8 w-48" />
          </div>
        </section>
      </div>
    </>
  );
}
