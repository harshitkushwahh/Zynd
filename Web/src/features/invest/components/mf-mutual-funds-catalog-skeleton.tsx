import { Skeleton } from "@/components/ui/skeleton";
import { MfFundCardSkeleton } from "@/features/invest/components/mf-fund-card";
import {
  MF_CARD_RADIUS_CLASS,
  MF_COLLECTIONS_GRID_CLASS,
  MF_FUND_CARD_HORIZONTAL_WIDTH_CLASS,
  MF_FUNDS_GRID_CLASS,
  MF_FUNDS_HORIZONTAL_ROW_CLASS,
} from "@/features/invest/lib/mf-ui";
import { cn } from "@/lib/utils";

function SectionHeaderSkeleton({ withTabs = false }: { withTabs?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <Skeleton className="h-6 w-36" />
      {withTabs ? (
        <div className="flex items-center gap-2 sm:gap-3">
          <Skeleton className={cn(MF_CARD_RADIUS_CLASS, "h-9 w-52")} />
          <Skeleton className="h-8 w-20" />
        </div>
      ) : (
        <Skeleton className="h-8 w-28" />
      )}
    </div>
  );
}

function CollectionCardSkeleton() {
  return (
    <Skeleton className={cn(MF_CARD_RADIUS_CLASS, "h-[8.75rem] w-full min-w-0")} />
  );
}

function MfDashboardSidebarSkeleton() {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[21rem]">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(MF_CARD_RADIUS_CLASS, "h-36 w-full border border-border/60")}
        />
      ))}
    </aside>
  );
}

function MfBreadcrumbSkeleton() {
  return (
    <div className="mb-6 flex shrink-0 items-center gap-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="size-3.5 rounded-full" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

export function MutualFundsCatalogSkeleton() {
  return (
    <div className="min-w-0 space-y-10">
      <section className="min-w-0 space-y-4">
        <SectionHeaderSkeleton />
        <div className={MF_FUNDS_HORIZONTAL_ROW_CLASS}>
          {Array.from({ length: 4 }).map((_, index) => (
            <MfFundCardSkeleton
              key={index}
              className={MF_FUND_CARD_HORIZONTAL_WIDTH_CLASS}
            />
          ))}
        </div>
      </section>

      <section className="min-w-0 space-y-4">
        <SectionHeaderSkeleton />
        <div className={MF_COLLECTIONS_GRID_CLASS}>
          {Array.from({ length: 4 }).map((_, index) => (
            <CollectionCardSkeleton key={index} />
          ))}
        </div>
      </section>

      <section className="min-w-0 space-y-4">
        <SectionHeaderSkeleton withTabs />
        <div className={MF_FUNDS_GRID_CLASS}>
          {Array.from({ length: 5 }).map((_, index) => (
            <MfFundCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function MutualFundsPageSkeleton() {
  return (
    <>
      <MfBreadcrumbSkeleton />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <MutualFundsCatalogSkeleton />
        </div>
        <MfDashboardSidebarSkeleton />
      </div>
    </>
  );
}
