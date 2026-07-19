import { Skeleton } from "@/components/ui/skeleton";
import {
  MF_CARD_RADIUS_CLASS,
  MF_INVEST_SIDEBAR_STICKY_CLASS,
  MF_INVEST_SIDEBAR_WIDTH_CLASS,
} from "@/features/invest/lib/mf-ui";
import { cn } from "@/lib/utils";

function MfFundDetailBreadcrumbSkeleton() {
  return (
    <div className="mb-6 flex shrink-0 items-center gap-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="size-3.5 rounded-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="size-3.5 rounded-full" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

function MfFundDetailHeaderSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex min-w-0 items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-[var(--radius-control)] sm:size-12" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-5 w-16 rounded-[var(--radius-control)]" />
            <Skeleton className="h-5 w-28 rounded-[var(--radius-control)]" />
          </div>
          <Skeleton className="h-6 w-full max-w-2xl" />
          <Skeleton className="h-6 w-4/5 max-w-xl" />
        </div>
      </div>
      <Skeleton className={cn("h-[5.25rem] w-full", MF_CARD_RADIUS_CLASS)} />
    </div>
  );
}

function MfFundDetailPaymentSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn("min-h-[30rem] w-full rounded-invest-card border border-zinc-200 dark:border-zinc-700/80", className)}
    />
  );
}

function MfFundDetailSectionSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className={cn("space-y-4 border border-border bg-card p-5 sm:p-6", MF_CARD_RADIUS_CLASS)}>
      <Skeleton className="h-5 w-32" />
      <Skeleton className={cn("w-full", tall ? "h-64" : "h-40")} />
    </div>
  );
}

export function MfFundDetailSkeleton({ showBreadcrumb = true }: { showBreadcrumb?: boolean }) {
  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {showBreadcrumb ? <MfFundDetailBreadcrumbSkeleton /> : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <MfFundDetailHeaderSkeleton />
          <div className="lg:hidden">
            <MfFundDetailPaymentSkeleton />
          </div>
          <MfFundDetailSectionSkeleton tall />
          <MfFundDetailSectionSkeleton />
          <MfFundDetailSectionSkeleton />
        </div>

        <aside
          className={cn(
            MF_INVEST_SIDEBAR_WIDTH_CLASS,
            MF_INVEST_SIDEBAR_STICKY_CLASS,
            "hidden lg:block",
          )}
        >
          <MfFundDetailPaymentSkeleton />
        </aside>
      </div>
    </div>
  );
}
