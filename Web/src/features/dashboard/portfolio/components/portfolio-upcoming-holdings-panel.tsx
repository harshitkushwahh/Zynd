"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Clock } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { MfUpcomingHoldingRow } from "@/features/invest/components/mf-upcoming-holding-row";
import { useMfOrdersQuery } from "@/features/invest/hooks/use-mf-orders-query";
import { getUpcomingHoldingOrders } from "@/features/invest/lib/mf-transaction-filters";
import {
  portfolioUpcomingHoldingDetailHref,
} from "@/features/dashboard/portfolio/lib/portfolio-holding-detail-data";
import { usePortfolioUninvestedEmpty } from "@/features/dashboard/portfolio/hooks/use-portfolio-uninvested-empty";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export function PortfolioUpcomingHoldingsPanel({ className }: { className?: string }) {
  const portfolioCopy = copy.dashboard.portfolio;
  const { orders, showSkeleton } = useMfOrdersQuery(100);
  const { processingTitle, processingDescription } = usePortfolioUninvestedEmpty();
  const upcomingOrders = useMemo(() => getUpcomingHoldingOrders(orders), [orders]);

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          ZYND_3XL_RADIUS_CLASS,
          "border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
            <Clock className="size-4" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-h4 font-semibold text-foreground">{processingTitle}</h2>
            <p className="mt-1 text-compact text-muted-foreground">{processingDescription}</p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          ZYND_3XL_RADIUS_CLASS,
          "border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
        )}
      >
        <div className="mb-3">
          <h3 className="text-compact font-semibold text-foreground">
            {portfolioCopy.overviewUpcomingHoldingsTitle}
          </h3>
        </div>

        {showSkeleton ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-[4.5rem] rounded-[1.15rem]" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingOrders.map((order, index) => (
              <Link
                key={order.order_id}
                href={portfolioUpcomingHoldingDetailHref(order)}
                className="block rounded-[1.15rem] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <MfUpcomingHoldingRow order={order} index={index} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
