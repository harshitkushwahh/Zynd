import { Skeleton } from "@/components/ui/skeleton";
import { MF_TRANSACTIONS_TABLE_FRAME_CLASS } from "@/features/invest/lib/mf-ui";
import { cn } from "@/lib/utils";

function MfTransactionsFilterBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
      <Skeleton className="h-8 w-[8.5rem] rounded-[var(--radius-control)]" />
      <Skeleton className="h-8 w-[8.5rem] rounded-[var(--radius-control)]" />
      <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
      <Skeleton className="h-8 w-20 rounded-full" />
      <Skeleton className="h-8 w-12 rounded-full" />
      <Skeleton className="h-8 w-16 rounded-full" />
      <Skeleton className="ml-auto h-8 w-16 rounded-[var(--radius-control)]" />
    </div>
  );
}

function MfTransactionsTableRowSkeleton() {
  return (
    <div className="flex min-h-14 items-center gap-4 border-b border-border/70 px-4 py-3 md:px-5">
      <div className="flex min-w-0 flex-[1.4] items-start gap-3">
        <Skeleton className="mt-0.5 size-8 shrink-0 rounded-[var(--radius-control)]" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-full max-w-[14rem]" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="hidden h-4 w-16 shrink-0 sm:block" />
      <Skeleton className="hidden h-4 w-14 shrink-0 sm:block" />
      <Skeleton className="hidden h-4 w-20 shrink-0 md:block" />
      <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
    </div>
  );
}

export function MfTransactionsTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col overflow-hidden" aria-hidden="true">
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-4 backdrop-blur-[var(--blur-sm)] md:px-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="hidden h-4 w-12 sm:block" />
          <Skeleton className="hidden h-4 w-14 sm:block" />
          <Skeleton className="hidden h-4 w-16 sm:block" />
          <Skeleton className="hidden h-4 w-14 md:block" />
          <Skeleton className="ml-auto h-4 w-12" />
        </div>
      </div>
      <div>
        {Array.from({ length: rows }).map((_, index) => (
          <MfTransactionsTableRowSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function MfTransactionsPageSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <MfTransactionsFilterBarSkeleton />
      <div className="relative min-w-0">
        <div
          className={cn(
            "relative rounded-[var(--radius-card)] border border-border bg-card",
            MF_TRANSACTIONS_TABLE_FRAME_CLASS,
          )}
        >
          <MfTransactionsTableSkeleton rows={6} />
        </div>
      </div>
    </div>
  );
}
