import { Skeleton } from "@/components/ui/skeleton";
import {
  MF_CARD_RADIUS_CLASS,
  MF_INVEST_PAYMENT_CARD_CLASS,
} from "@/features/invest/lib/mf-ui";
import { cn } from "@/lib/utils";

function CartItemRowSkeleton() {
  return (
    <li
      className={cn(
        "flex items-start gap-3 border border-border bg-card p-4 sm:gap-4 sm:p-5",
        MF_CARD_RADIUS_CLASS,
      )}
    >
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <Skeleton className="h-4 w-full max-w-[18rem]" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="size-9 shrink-0 rounded-[var(--radius-control)]" />
    </li>
  );
}

function CartOrderSummarySkeleton() {
  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col overflow-hidden xl:sticky xl:top-6 xl:self-start",
        MF_INVEST_PAYMENT_CARD_CLASS,
        MF_CARD_RADIUS_CLASS,
      )}
    >
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-muted/10 px-5 py-4 dark:border-zinc-700/80">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="size-8 shrink-0 rounded-full" />
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <Skeleton className="h-[5.5rem] w-full rounded-[var(--radius-card)]" />

        <div className="space-y-2.5">
          <Skeleton className="h-3.5 w-20" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-11 rounded-[var(--radius-control)]" />
            <Skeleton className="h-11 rounded-[var(--radius-control)]" />
          </div>
        </div>

        <Skeleton className="h-[4.5rem] w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-11 w-full rounded-[var(--radius-control)]" />
      </div>
    </aside>
  );
}

export function MfCartPageSkeleton({ itemRows = 4 }: { itemRows?: number }) {
  return (
    <div className="space-y-5 pb-6" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11 w-full max-w-md rounded-full" />
        <Skeleton className="h-8 w-24 rounded-[var(--radius-control)]" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <ul className="space-y-3">
          {Array.from({ length: itemRows }).map((_, index) => (
            <CartItemRowSkeleton key={index} />
          ))}
        </ul>
        <CartOrderSummarySkeleton />
      </div>
    </div>
  );
}
