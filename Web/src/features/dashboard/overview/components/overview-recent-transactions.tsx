"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { FieldMessage } from "@/components/ui/ui-message";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import { OverviewCompactCardHeader } from "@/features/dashboard/overview/components/overview-compact-card-header";
import { OVERVIEW_TRANSACTIONS_LOCKED_PREVIEW } from "@/features/dashboard/overview/lib/overview-locked-preview-data";
import { type MfOrder } from "@/features/invest/api/invest-api";
import { useMfOrdersQuery } from "@/features/invest/hooks/use-mf-orders-query";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import {
  MfOrderStatusBadge,
  mfOrderRowAvatarClass,
  mfOrderRowHoverClass,
} from "@/features/invest/components/mf-order-status-badge";
import { MfOrderJourneyDialog } from "@/features/invest/components/payment-dialog";
import { formatDate, formatInr } from "@/features/invest/lib/mf-format";
import { sortMfTransactions } from "@/features/invest/lib/mf-transaction-filters";
import { portfolioTabHref } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;
const OVERVIEW_ORDERS_LIMIT = 100;
const TRANSACTIONS_HREF = portfolioTabHref("transactions");
const MF_BROWSE_HREF = "/dashboard/mutual-funds";

function formatOrderType(orderType: string) {
  const normalized = orderType.trim().toUpperCase();
  if (normalized === "LUMPSUM") return copy.transactions.typeLumpsum;
  if (normalized === "SIP") return copy.transactions.typeSip;
  if (normalized === "REDEMPTION") return copy.transactions.typeRedemption;
  return orderType.replaceAll("_", " ");
}

function RecentTransactionRowPreview({ order }: { order: MfOrder }) {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-2.5 gap-y-1 rounded-[1rem] px-2 py-2">
      <span
        className={cn(
          "row-span-2 flex size-9 shrink-0 items-center justify-center justify-self-start rounded-full ring-1",
          mfOrderRowAvatarClass(order.status, order.fp_state),
        )}
      >
        <MfFundAmcAvatar
          amcLogoUrl={order.amc_logo_url}
          amcName={order.amc_name ?? copy.mutualFunds.unknownAmc}
          className="rounded-full"
        />
      </span>

      <p className="col-start-2 min-w-0 truncate text-compact font-semibold text-foreground">
        {order.product_name ?? copy.mutualFunds.unknownFund}
      </p>

      <div className="col-start-3 row-span-2 flex max-w-[min(100%,11rem)] shrink-0 flex-col items-end justify-center gap-1 self-center sm:max-w-none">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <MfOrderStatusBadge
            status={order.status}
            fpState={order.fp_state}
          />
          <p className="text-compact font-semibold tabular-nums tracking-tight text-foreground">
            {formatInr(order.amount_inr)}
          </p>
        </div>
      </div>

      <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="inline-flex rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60">
          {formatOrderType(order.order_type)}
        </span>
        <span className="text-[11px] text-muted-foreground">{formatDate(order.created_at)}</span>
      </div>
    </div>
  );
}

function RecentTransactionRow({
  order,
  onClick,
}: {
  order: MfOrder;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group grid w-full min-w-0 max-w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-2.5 gap-y-1 rounded-[1rem] px-2 py-2 text-left",
        "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        mfOrderRowHoverClass(order.status, order.fp_state),
      )}
    >
      <span
        className={cn(
          "row-span-2 flex size-9 shrink-0 items-center justify-center justify-self-start rounded-full ring-1",
          mfOrderRowAvatarClass(order.status, order.fp_state),
        )}
      >
        <MfFundAmcAvatar
          amcLogoUrl={order.amc_logo_url}
          amcName={order.amc_name ?? copy.mutualFunds.unknownAmc}
          className="rounded-full"
        />
      </span>

      <p className="col-start-2 min-w-0 truncate text-compact font-semibold text-foreground">
        {order.product_name ?? copy.mutualFunds.unknownFund}
      </p>

      <div className="col-start-3 row-span-2 flex max-w-[min(100%,12rem)] shrink-0 flex-col items-end justify-center gap-1 self-center sm:max-w-none">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <MfOrderStatusBadge
            status={order.status}
            fpState={order.fp_state}
          />
          <p className="text-compact font-semibold tabular-nums tracking-tight text-foreground">
            {formatInr(order.amount_inr)}
          </p>
          <ChevronRight
            className="size-3.5 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground"
            strokeWidth={2.25}
            aria-hidden
          />
        </div>
      </div>

      <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="inline-flex rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60">
          {formatOrderType(order.order_type)}
        </span>
        <span className="text-[11px] text-muted-foreground">{formatDate(order.created_at)}</span>
      </div>
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
  const isLocked = !loading && !error && recentOrders.length === 0;

  useEffect(() => {
    if (journeyOpen) return;

    const timer = window.setTimeout(() => {
      setSelectedOrderId(null);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [journeyOpen]);

  const cardClassName = cn(
    "relative flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
    isLocked &&
      "group transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/25 hover:shadow-zynd-mid",
    className,
  );

  const cardContent = (
    <>
      <OverviewCompactCardHeader
        title={overview.recentTransactionsTitle}
        href={isLocked ? undefined : TRANSACTIONS_HREF}
        ariaLabel={overview.recentTransactionsViewAll}
        groupHover={isLocked}
      />

      {isLocked ? (
        <div className="relative mt-4 flex min-h-[12rem] flex-1 flex-col">
          <div className="pointer-events-none flex flex-1 select-none flex-col blur-[5px]">
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-[1.25rem] bg-muted/45 p-2 sm:p-2.5">
              <div className="min-w-0 space-y-0.5 overflow-x-hidden">
                {OVERVIEW_TRANSACTIONS_LOCKED_PREVIEW.map((order) => (
                  <RecentTransactionRowPreview key={order.order_id} order={order} />
                ))}
              </div>
            </div>
          </div>
          <OverviewLockedCardBackdrop />
          <OverviewLockedCardOverlay
            title={overview.recentTransactionsTitle}
            subtitle={overview.recentTransactionsEmpty}
          />
        </div>
      ) : (
        <>
          {loading ? (
            <div className="mt-4 rounded-[1.25rem] bg-muted/45 p-2.5">
              <div className="space-y-1.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-2.5 px-2 py-2">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/5" />
                      <Skeleton className="h-3 w-2/5" />
                    </div>
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4">
              <FieldMessage variant="error" message={error} />
            </div>
          ) : null}

          {!loading && !error && recentOrders.length > 0 ? (
            <div className="mt-4 min-h-0 min-w-0 flex-1 overflow-hidden rounded-[1.25rem] bg-muted/45 p-2 sm:p-2.5">
              <div className="max-h-[14rem] min-w-0 space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain [scrollbar-width:thin]">
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
            </div>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <>
      {isLocked ? (
        <Link
          href={MF_BROWSE_HREF}
          className={cardClassName}
          aria-label={`${overview.recentTransactionsTitle}. ${overview.recentTransactionsEmpty}`}
        >
          {cardContent}
        </Link>
      ) : (
        <section className={cardClassName}>{cardContent}</section>
      )}

      <MfOrderJourneyDialog
        open={journeyOpen}
        orderId={selectedOrderId}
        onOpenChange={setJourneyOpen}
      />
    </>
  );
}

export function OverviewRecentTransactionsSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-3.5" />
      </div>
      <div className="mt-4 rounded-[1.25rem] bg-muted/45 p-2.5">
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2.5 px-2 py-2">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
