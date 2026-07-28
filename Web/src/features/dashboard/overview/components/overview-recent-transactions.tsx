"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { Skeleton } from "@/components/ui/skeleton";
import { type MfOrder } from "@/features/invest/api/invest-api";
import { useMfOrdersQuery } from "@/features/invest/hooks/use-mf-orders-query";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import {
  MfOrderStatusBadge,
  mfOrderStatusVariant,
} from "@/features/invest/components/mf-order-status-badge";
import { MfOrderJourneyDialog } from "@/features/invest/components/payment-dialog";
import { formatDate, formatInr } from "@/features/invest/lib/mf-format";
import { sortMfTransactions } from "@/features/invest/lib/mf-transaction-filters";
import { ZYND_CARD_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;
const OVERVIEW_ORDERS_LIMIT = 100;

function formatOrderType(orderType: string) {
  const normalized = orderType.trim().toUpperCase();
  if (normalized === "LUMPSUM") return copy.transactions.typeLumpsum;
  if (normalized === "SIP") return copy.transactions.typeSip;
  if (normalized === "REDEMPTION") return copy.transactions.typeRedemption;
  return orderType.replaceAll("_", " ");
}

function RecentTransactionRow({
  order,
  onClick,
}: {
  order: MfOrder;
  onClick: () => void;
}) {
  const isDestructive = mfOrderStatusVariant(order.status) === "destructive";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[0.9rem] border px-3 py-2.5 text-left",
        "shadow-zynd-low transition-all duration-200",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        isDestructive
          ? "border-destructive/20 bg-destructive/[0.06] hover:border-destructive/30 hover:bg-destructive/[0.09] hover:shadow-zynd-mid"
          : "border-border/70 bg-background/60 hover:border-primary/25 hover:bg-muted/30 hover:shadow-zynd-mid",
      )}
    >
      <MfOrderStatusBadge status={order.status} />

      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border",
          isDestructive
            ? "border-destructive/15 bg-destructive/5"
            : "border-border/60 bg-muted/40",
        )}
      >
        <MfFundAmcAvatar
          amcLogoUrl={order.amc_logo_url}
          amcName={order.amc_name ?? copy.mutualFunds.unknownAmc}
          className="rounded-full"
        />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-compact font-semibold text-foreground">
          {order.product_name ?? copy.mutualFunds.unknownFund}
        </p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {formatOrderType(order.order_type)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(order.created_at)}
          </span>
        </div>
      </div>

      <p className="shrink-0 text-compact font-semibold tabular-nums tracking-tight text-foreground">
        {formatInr(order.amount_inr)}
      </p>

      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground"
        strokeWidth={2.25}
        aria-hidden
      />
    </button>
  );
}

type OverviewRecentTransactionsProps = {
  className?: string;
};

export function OverviewRecentTransactions({ className }: OverviewRecentTransactionsProps) {
  const { overview } = copy.dashboard;
  const { orders, showSkeleton, errorMessage } = useMfOrdersQuery(OVERVIEW_ORDERS_LIMIT);
  const loading = showSkeleton;
  const error = errorMessage;
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [journeyOpen, setJourneyOpen] = useState(false);

  const recentOrders = useMemo(
    () => sortMfTransactions(orders).slice(0, PREVIEW_LIMIT),
    [orders],
  );

  useEffect(() => {
    if (journeyOpen) return;

    const timer = window.setTimeout(() => {
      setSelectedOrderId(null);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [journeyOpen]);

  return (
    <>
      <section
        className={cn(
          ZYND_CARD_RADIUS_CLASS,
          "flex h-full min-w-0 flex-col border border-border bg-card shadow-zynd-low",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-cyan-500/12 text-cyan-700 dark:text-cyan-300">
                <ArrowLeftRight className="size-4" strokeWidth={2.25} />
              </span>
              <div>
                <p className="text-compact font-semibold text-foreground">
                  {overview.recentTransactionsTitle}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {overview.recentTransactionsDescription}
                </p>
              </div>
            </div>
          </div>
          {!loading && !error && recentOrders.length > 0 ? (
            <Button
              variant="muted"
              size="sm"
              className="shrink-0"
              nativeButton={false}
              render={<Link href="/dashboard/transactions" />}
            >
              {overview.recentTransactionsViewAll}
            </Button>
          ) : null}
        </div>

        <div className="px-3.5 py-3">
          {loading ? (
            <div className="max-h-[14rem] space-y-2 overflow-hidden">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-[0.9rem] border border-border/60 px-3 py-2.5"
                >
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Skeleton className="h-3.5 w-14" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {error ? (
            <div className="py-2">
              <FieldMessage variant="error" message={error} />
            </div>
          ) : null}
          {!loading && !error && recentOrders.length === 0 ? (
            <div className="flex min-h-[10rem] items-center justify-center px-2 py-6 text-center">
              <p className="text-caption text-muted-foreground">
                {overview.recentTransactionsEmpty}
              </p>
            </div>
          ) : null}
          {!loading && !error && recentOrders.length > 0 ? (
            <div className="max-h-[14rem] space-y-2 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]">
              {recentOrders.map((order) => (
                <RecentTransactionRow
                  key={order.order_id}
                  order={order}
                  onClick={() => {
                    setSelectedOrderId(order.order_id);
                    setJourneyOpen(true);
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <MfOrderJourneyDialog
        open={journeyOpen}
        orderId={selectedOrderId}
        onOpenChange={setJourneyOpen}
      />
    </>
  );
}
