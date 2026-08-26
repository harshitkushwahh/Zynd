import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type MfFundsTableSkeletonProps = {
  rows?: number;
  className?: string;
};

export function MfFundsTableSkeleton({ rows = 8, className }: MfFundsTableSkeletonProps) {
  return (
    <div className={cn("flex h-full min-h-[280px] flex-col p-4", className)} aria-busy="true">
      <div className="mb-4 hidden gap-3 border-b border-border/60 pb-3 sm:grid sm:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-16" />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-[var(--radius-control)] px-1 py-2">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5 max-w-[12rem]" />
              <Skeleton className="h-3 w-1/3 max-w-[8rem]" />
            </div>
            <Skeleton className="hidden h-4 w-12 sm:block" />
            <Skeleton className="hidden h-4 w-14 md:block" />
            <Skeleton className="hidden h-4 w-10 lg:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
