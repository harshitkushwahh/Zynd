import { Skeleton } from "@/components/ui/skeleton";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

function PortfolioRedeemUnitsRowSkeleton() {
  return (
    <div className="flex min-h-14 items-center gap-4 border-b border-border/70 px-4 py-3.5 md:px-5">
      <div className="flex min-w-0 flex-[1.4] items-start gap-3">
        <Skeleton className="mt-0.5 size-8 shrink-0 rounded-[var(--radius-control)]" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-full max-w-[14rem]" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-16 shrink-0" />
      <Skeleton className="h-4 w-20 shrink-0" />
    </div>
  );
}

export function PortfolioRedeemUnitsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "overflow-hidden border border-border/60 bg-card shadow-zynd-low",
      )}
      aria-busy="true"
      aria-hidden="true"
    >
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3.5 md:px-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div>
        {Array.from({ length: rows }).map((_, index) => (
          <PortfolioRedeemUnitsRowSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
