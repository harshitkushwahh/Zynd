"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import { PORTFOLIO_PAGE_HREF } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import { usePortfolioSummaryQuery } from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { useMfOrdersQuery } from "@/features/invest/hooks/use-mf-orders-query";
import {
  getUpcomingHoldingOrders,
  sumUpcomingHoldingOrdersInr,
} from "@/features/invest/lib/mf-transaction-filters";
import {
  investedChartTone,
  MfYourInvestedChart,
} from "@/features/invest/components/mf-your-invested-chart";
import {
  MF_INVESTED_LOCKED_PREVIEW,
  type MfInvestedPreview,
} from "@/features/invest/lib/mf-dashboard-sidebar-data";
import {
  mapPortfolioSummaryToInvestedPreview,
  portfolioSummaryHasInvestments,
} from "@/features/invest/lib/mf-invested-card-mapper";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { mfReturnTonePillClass } from "@/features/invest/lib/mf-return-tone-styles";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function changePillClass(tone: "positive" | "negative" | "muted") {
  return mfReturnTonePillClass(tone);
}

function metaPillClass() {
  return "inline-flex items-center rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground";
}

function MfYourInvestedCardBody({ data }: { data: MfInvestedPreview }) {
  const totalReturn = formatSignedReturn(data.totalReturnPct);
  const chartTone = investedChartTone(data.totalReturnPct);

  return (
    <>
      <div className="relative z-10 px-3.5 pb-0 pt-3.5 text-center">
        <p className="text-caption text-muted-foreground">{copy.mutualFunds.yourInvestedTotalLabel}</p>
        <p className="mt-0.5 text-h4 font-bold tabular-nums tracking-tight text-foreground">
          {formatInr(data.totalValueInr)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span className={changePillClass(totalReturn.tone)}>{totalReturn.text}</span>
          <span className={metaPillClass()}>{formatInr(data.investedInr)}</span>
        </div>
      </div>

      <div className="relative mt-2 w-full pointer-events-none [&_.recharts-cartesian-grid]:overflow-visible [&_.recharts-surface]:overflow-visible">
        <MfYourInvestedChart points={data.dayChangePoints} tone={chartTone} className="w-full" />
      </div>
    </>
  );
}

function MfYourInvestedProcessingBody({ pendingInr, upcomingCount }: { pendingInr: number; upcomingCount: number }) {
  return (
    <div className="relative z-10 px-3.5 pb-4 pt-3.5 text-center">
      <p className="text-caption text-muted-foreground">{copy.mutualFunds.yourInvestedTitle}</p>
      <p className="mt-0.5 text-h4 font-bold tabular-nums tracking-tight text-foreground">
        {formatInr(pendingInr)}
      </p>
      <div className="mt-2 space-y-1">
        <span className="inline-flex items-center rounded-full bg-warning/12 px-2 py-0.5 text-[11px] font-semibold text-warning">
          {copy.transactions.orderStatusAwaitingAllotment}
        </span>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {upcomingCount} {upcomingCount === 1 ? "fund" : "funds"} Awaiting Allotment
        </p>
      </div>
    </div>
  );
}

export function MfYourInvestedCard() {
  const { summary, showSkeleton } = usePortfolioSummaryQuery();
  const { orders, showSkeleton: ordersLoading } = useMfOrdersQuery(100);
  const upcomingOrders = useMemo(() => getUpcomingHoldingOrders(orders), [orders]);
  const pendingInr = useMemo(() => sumUpcomingHoldingOrdersInr(orders), [orders]);
  const hasInvestments = summary ? portfolioSummaryHasInvestments(summary) : false;
  const hasHoldings =
    (summary?.holdings_count ?? 0) > 0 ||
    (summary?.current_value_inr ?? 0) > 0 ||
    (summary?.invested_inr ?? 0) > 0;
  const isProcessing =
    !hasHoldings && (summary?.has_pending_orders || upcomingOrders.length > 0) && pendingInr > 0;
  const liveData = summary ? mapPortfolioSummaryToInvestedPreview(summary) : null;
  const previewData = MF_INVESTED_LOCKED_PREVIEW;
  const isLocked = !showSkeleton && !ordersLoading && summary != null && !hasInvestments && !isProcessing;
  const cardHref = isLocked ? "/dashboard/mutual-funds/all" : PORTFOLIO_PAGE_HREF;
  const loading = showSkeleton || ordersLoading;

  return (
    <Link
      href={cardHref}
      aria-label={
        isLocked
          ? `${copy.dashboard.overview.holdingsInvestmentsTitle}. ${copy.dashboard.overview.holdingsEmpty}`
          : copy.mutualFunds.yourInvestedViewPortfolio
      }
      className={cn(
        "group relative block min-w-0 max-w-full overflow-hidden rounded-3xl border border-border/70 bg-card transition-[border-color,box-shadow,background-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isLocked
          ? "hover:border-primary/25 hover:shadow-zynd-mid"
          : "hover:border-border hover:bg-muted/10",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute right-2.5 top-2.5 z-20 flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/20 text-muted-foreground transition-colors group-hover:bg-muted/40 group-hover:text-foreground"
      >
        <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
      </span>

      {loading ? (
        <>
          <div className="relative z-10 px-3.5 pb-0 pt-3.5 text-center">
            <p className="text-caption text-muted-foreground">{copy.mutualFunds.yourInvestedTotalLabel}</p>
            <div className="mt-1 flex flex-col items-center gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
          <div className="relative mt-2 w-full">
            <Skeleton className="mx-auto h-14 w-[calc(100%-1rem)] rounded-[var(--radius-control)]" />
          </div>
        </>
      ) : isLocked ? (
        <div className="relative flex min-h-[9.5rem] flex-1 flex-col">
          <div className="pointer-events-none flex flex-1 select-none flex-col blur-[5px]">
            <MfYourInvestedCardBody data={previewData} />
          </div>
          <OverviewLockedCardBackdrop className="inset-0" />
          <OverviewLockedCardOverlay
            compact
            className="inset-0"
            title={copy.dashboard.overview.holdingsInvestmentsTitle}
            subtitle={copy.dashboard.overview.holdingsEmpty}
          />
        </div>
      ) : isProcessing ? (
        <MfYourInvestedProcessingBody pendingInr={pendingInr} upcomingCount={upcomingOrders.length} />
      ) : liveData ? (
        <MfYourInvestedCardBody data={liveData} />
      ) : null}
    </Link>
  );
}
