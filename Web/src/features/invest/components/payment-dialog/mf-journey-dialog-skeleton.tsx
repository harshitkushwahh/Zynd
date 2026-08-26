import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Scroll shell inside BrandDialog — mobile scrolls as one column; desktop delegates to panels. */
export const MF_JOURNEY_DIALOG_BODY_SHELL_CLASS =
  "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:none] md:overflow-hidden [&::-webkit-scrollbar]:hidden";

/** Two-column journey grid — fills the dialog body on desktop. */
export const MF_JOURNEY_DIALOG_GRID_CLASS =
  "grid min-h-0 grid-cols-1 md:flex-1 md:overflow-hidden md:items-stretch";

export const MF_JOURNEY_DIALOG_SCROLL_PANEL_CLASS =
  "min-h-0 md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type MfJourneyDialogSkeletonProps = {
  variant?: "order" | "sip";
  className?: string;
};

function SummaryCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-muted/20 p-3.5", className)}>
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="mt-2 h-5 w-24" />
    </div>
  );
}

function TimelineStepSkeleton({ isLast = false }: { isLast?: boolean }) {
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-3">
      <div className="flex flex-col items-center self-stretch pt-1">
        <Skeleton className="size-5 rounded-full" />
        {!isLast ? <Skeleton className="mt-1 h-10 w-px" /> : null}
      </div>
      <div className={cn("min-w-0 space-y-2", !isLast && "pb-4")}>
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-full max-w-[15rem]" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className={cn("h-5 w-16 rounded-full", !isLast && "pb-4")} />
    </div>
  );
}

export function MfJourneyDialogSkeleton({ variant = "order", className }: MfJourneyDialogSkeletonProps) {
  const isSip = variant === "sip";

  return (
    <div
      className={cn(
        MF_JOURNEY_DIALOG_GRID_CLASS,
        isSip
          ? "md:grid-cols-[minmax(24rem,30rem)_minmax(0,1fr)]"
          : "md:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]",
        className,
      )}
      aria-busy="true"
      aria-hidden
    >
      <aside
        className={cn(
          "border-b border-border/60 bg-muted/10 p-5 sm:p-6 md:border-b-0 md:border-r",
          MF_JOURNEY_DIALOG_SCROLL_PANEL_CLASS,
        )}
      >
        <div className="flex flex-col items-center md:items-start">
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="mt-4 h-5 w-full max-w-[14rem]" />
          <Skeleton className="mt-2 h-3 w-36 max-w-full" />
          {isSip ? <Skeleton className="mt-1 h-3 w-28 max-w-full" /> : null}
        </div>

        <div
          className={cn(
            "mt-5 grid gap-3",
            isSip ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
          )}
        >
          <SummaryCardSkeleton />
          {isSip ? <SummaryCardSkeleton /> : null}
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          <SummaryCardSkeleton />
          {isSip ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton className="sm:col-span-2" />
            </>
          ) : (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3 pr-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/10 px-3 py-4 sm:px-4">
          <TimelineStepSkeleton />
          <TimelineStepSkeleton isLast />
        </div>
      </section>
    </div>
  );
}
