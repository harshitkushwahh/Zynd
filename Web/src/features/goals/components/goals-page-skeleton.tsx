import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_TEMPLATE_CARD_WIDTH_CLASS } from "@/features/goals/lib/goal-template-meta";

export function GoalsPageSkeleton() {
  return (
    <div
      className="animate-in fade-in grid items-start gap-6 duration-200 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="min-w-0 space-y-8">
        <div className="relative min-w-0">
          <div className="flex gap-3 overflow-hidden pb-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                className={`${GOAL_TEMPLATE_CARD_WIDTH_CLASS} h-[8.75rem] rounded-[var(--radius-card)]`}
              />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-7 w-32" />
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton
                key={`personal-${index}`}
                className="h-[5.5rem] w-[12rem] rounded-[var(--radius-card)]"
              />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-7 w-36" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 1 }).map((_, index) => (
              <Skeleton key={`family-${index}`} className="h-44 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[20rem] rounded-[var(--radius-card)]" />
        <Skeleton className="h-[28rem] rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
