import { Skeleton } from "@/components/ui/skeleton";

type MfPaymentCheckoutDetailsSkeletonProps = {
  orderLines?: number;
};

export function MfPaymentCheckoutDetailsSkeleton({
  orderLines = 1,
}: MfPaymentCheckoutDetailsSkeletonProps) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="rounded-[var(--radius-card)] border border-border bg-muted/15 px-3.5 py-3">
        <Skeleton className="h-3 w-20" />
        <div className="mt-2 flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-3 w-36 max-w-full" />
          </div>
        </div>
      </div>

      {orderLines > 0 ? (
        <ul className="space-y-2 rounded-[var(--radius-card)] border border-border px-4 py-3">
          {Array.from({ length: orderLines }, (_, index) => (
            <li key={index} className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 min-w-0 flex-1" />
              <Skeleton className="h-4 w-14 shrink-0" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
