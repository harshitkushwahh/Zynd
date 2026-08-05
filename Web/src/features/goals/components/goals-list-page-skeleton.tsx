import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function GoalListCardSkeleton({ variant }: { variant: "personal" | "family" }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card p-0 shadow-none">
      <div className="flex items-start justify-between gap-3 p-6 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-36 max-w-full" />
            <Skeleton className="h-4 w-44 max-w-full" />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Skeleton className="h-5 w-14 rounded-full" />
          {variant === "personal" ? <Skeleton className="h-5 w-16 rounded-full" /> : null}
        </div>
      </div>
      <div className="space-y-2 px-6 pb-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

type GoalsListPageSkeletonProps = {
  variant: "personal" | "family";
  className?: string;
};

export function GoalsListPageSkeleton({ variant, className }: GoalsListPageSkeletonProps) {
  const count = variant === "personal" ? 6 : 4;

  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, index) => (
        <GoalListCardSkeleton key={index} variant={variant} />
      ))}
    </div>
  );
}
