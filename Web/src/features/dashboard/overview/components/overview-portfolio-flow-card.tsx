"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { OverviewCompactCardHeader } from "@/features/dashboard/overview/components/overview-compact-card-header";
import { OverviewPortfolioFlowChart } from "@/features/dashboard/overview/components/overview-portfolio-flow-chart";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import { usePortfolioSummaryQuery } from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { PORTFOLIO_PAGE_HREF } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import {
  type OverviewPortfolioFlowPoint,
  type OverviewPortfolioFlowRange,
} from "@/features/dashboard/overview/lib/overview-portfolio-flow-series";
import {
  OVERVIEW_PORTFOLIO_FLOW_LOCKED_SERIES,
  OVERVIEW_PORTFOLIO_LOCKED_PREVIEW,
} from "@/features/dashboard/overview/lib/overview-locked-preview-data";
import type { OverviewPortfolioPreview } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import { useMfOrdersQuery } from "@/features/invest/hooks/use-mf-orders-query";
import {
  getUpcomingHoldingOrders,
  sumUpcomingHoldingOrdersInr,
} from "@/features/invest/lib/mf-transaction-filters";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import {
  MfReturnDirectionBadge,
  mfReturnToneTextClass,
} from "@/features/invest/lib/mf-return-tone-styles";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type OverviewPortfolioFlowCardProps = {
  data?: OverviewPortfolioPreview | null;
  series?: readonly OverviewPortfolioFlowPoint[];
  className?: string;
};

function PortfolioFlowProcessingBody({
  data,
  upcomingCount,
  chartSeries,
}: {
  data: OverviewPortfolioPreview;
  upcomingCount: number;
  chartSeries: readonly OverviewPortfolioFlowPoint[];
}) {
  const portfolioCopy = copy.dashboard.portfolio;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 top-6 select-none blur-[5px] opacity-70"
      >
        <div className="mt-auto px-1 pt-3 sm:px-2">
          <OverviewPortfolioFlowChart
            series={[...chartSeries]}
            range="1y"
            onRangeChange={() => undefined}
          />
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="px-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[2rem]">
              {formatInr(data.investedInr)}
            </p>
          </div>
        </div>

        <div className="mt-auto px-4 pb-4 pt-3 sm:px-5">
          <div className="flex items-center gap-2.5 rounded-[1.15rem] border border-warning/25 bg-warning/10 px-3 py-3 backdrop-blur-[2px]">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
              <Clock className="size-4" strokeWidth={2.25} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-compact font-semibold text-warning">
                {portfolioCopy.overviewUpcomingHoldingsTitle}
              </p>
              <p className="mt-0.5 text-caption text-warning/80">
                {upcomingCount} {upcomingCount === 1 ? "fund" : "funds"} awaiting unit allotment
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioFlowCardBody({
  data,
  series,
  locked = false,
  chartInteractive = false,
}: {
  data: OverviewPortfolioPreview;
  series: readonly OverviewPortfolioFlowPoint[];
  locked?: boolean;
  chartInteractive?: boolean;
}) {
  const totalReturn = formatSignedReturn(data.totalReturnPct);
  const dayChange = formatSignedReturn(data.dayChangePct);
  const [range, setRange] = useState<OverviewPortfolioFlowRange>("1y");

  const chartSection = (
    <div className={cn("mt-auto px-1 pt-3 sm:px-2", locked && "pointer-events-none select-none")}>
      <OverviewPortfolioFlowChart
        series={[...series]}
        range={range}
        onRangeChange={locked ? () => undefined : setRange}
      />
    </div>
  );

  return (
    <>
      <div className="px-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[2rem]">
              {formatInr(data.currentValueInr)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className={cn("text-compact font-semibold tabular-nums", mfReturnToneTextClass(totalReturn.tone))}
            >
              {totalReturn.text}
            </span>
            <MfReturnDirectionBadge tone={totalReturn.tone} />
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-caption">
          <span className={cn("font-semibold tabular-nums", mfReturnToneTextClass(totalReturn.tone))}>
            {formatInr(data.totalReturnInr)} ({totalReturn.text})
          </span>
          <span className="text-muted-foreground">·</span>
          <span className={cn("font-medium tabular-nums", mfReturnToneTextClass(dayChange.tone))}>
            {dayChange.text} today · {formatInr(data.dayChangeInr)}
          </span>
        </div>
      </div>

      {chartInteractive ? (
        <div
          className="relative z-10"
          onClick={(event) => event.preventDefault()}
          onKeyDown={(event) => event.stopPropagation()}
          role="presentation"
        >
          {chartSection}
        </div>
      ) : (
        chartSection
      )}
    </>
  );
}

export function OverviewPortfolioFlowCard({
  data: dataProp = null,
  series: seriesProp = [],
  className,
}: OverviewPortfolioFlowCardProps) {
  const overview = copy.dashboard.overview;
  const portfolioCopy = copy.dashboard.portfolio;
  const { preview, flowSeries, showSkeleton, summary } = usePortfolioSummaryQuery();
  const { orders, showSkeleton: ordersLoading } = useMfOrdersQuery(100);

  const upcomingOrders = useMemo(() => getUpcomingHoldingOrders(orders), [orders]);
  const pendingInr = useMemo(() => sumUpcomingHoldingOrdersInr(orders), [orders]);

  const liveData = dataProp ?? preview;
  const liveSeries = seriesProp.length > 0 ? seriesProp : flowSeries;
  const hasChartData = Boolean(liveData && liveSeries.length > 0);
  const hasHoldings =
    (summary?.holdings_count ?? 0) > 0 ||
    (summary?.current_value_inr ?? 0) > 0 ||
    (summary?.invested_inr ?? 0) > 0;
  const isProcessing =
    !hasChartData &&
    !hasHoldings &&
    (summary?.has_pending_orders || upcomingOrders.length > 0);

  const processingPreview = useMemo<OverviewPortfolioPreview | null>(() => {
    if (!isProcessing || pendingInr <= 0) return null;
    return {
      currentValueInr: pendingInr,
      investedInr: pendingInr,
      totalReturnInr: 0,
      totalReturnPct: 0,
      dayChangeInr: 0,
      dayChangePct: 0,
      xirrPct: 0,
      holdingsCount: 0,
      activeSipsCount: summary?.active_sips_count ?? 0,
      monthlySipInr: summary?.monthly_sip_inr ?? 0,
      growth: [],
      allocation: [],
    };
  }, [isProcessing, pendingInr, summary?.active_sips_count, summary?.monthly_sip_inr]);

  const previewData = OVERVIEW_PORTFOLIO_LOCKED_PREVIEW;
  const previewSeries = OVERVIEW_PORTFOLIO_FLOW_LOCKED_SERIES;
  const isLocked = !showSkeleton && !ordersLoading && !hasChartData && !isProcessing;
  const loading = showSkeleton || ordersLoading;

  const cardClassName = cn(
    "group flex min-h-[13.5rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-zynd-low",
    isLocked &&
      "transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/25 hover:shadow-zynd-mid",
    className,
  );

  return (
    <Link
      href={PORTFOLIO_PAGE_HREF}
      className={cardClassName}
      aria-label={
        isLocked
          ? `${overview.portfolioTitle}. ${overview.portfolioFlowEmpty}`
          : isProcessing
            ? `${overview.portfolioTitle}. ${portfolioCopy.overviewUpcomingHoldingsTitle}`
            : overview.portfolioViewAll
      }
    >
      <div className="px-4 pt-3.5 sm:px-5 sm:pt-4">
        <OverviewCompactCardHeader
          title={overview.portfolioTitle}
          groupHover={isLocked}
          ariaLabel={overview.portfolioViewAll}
        />
      </div>

      {loading ? (
        <div className="px-4 pb-4 sm:px-5">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-3 h-3.5 w-56 max-w-full" />
          <Skeleton className="mt-6 h-[6.75rem] w-full rounded-[var(--radius-control)]" />
        </div>
      ) : hasChartData && liveData ? (
        <PortfolioFlowCardBody data={liveData} series={liveSeries} chartInteractive />
      ) : isProcessing && processingPreview ? (
        <PortfolioFlowProcessingBody
          data={processingPreview}
          upcomingCount={upcomingOrders.length}
          chartSeries={previewSeries}
        />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col pb-1">
          <div className="pointer-events-none flex flex-1 select-none flex-col blur-[5px]">
            <PortfolioFlowCardBody data={previewData} series={previewSeries} locked />
          </div>
          <OverviewLockedCardBackdrop />
          <OverviewLockedCardOverlay
            title={overview.portfolioTitle}
            subtitle={overview.portfolioFlowEmpty}
          />
        </div>
      )}
    </Link>
  );
}

export function OverviewPortfolioFlowCardSkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "flex min-h-[13.5rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-zynd-low",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-3.5 sm:px-5 sm:pt-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-3.5" />
      </div>
      <div className="px-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-36" />
          </div>
          <Skeleton className="h-6 w-14" />
        </div>
        <Skeleton className="mt-3 h-3.5 w-56 max-w-full" />
      </div>
      <div className="mt-auto px-2 pt-3">
        <Skeleton className="h-[6.75rem] w-full rounded-[var(--radius-control)]" />
        <div className="flex justify-center gap-1 px-2 pb-2 pt-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-9 rounded-full" />
          ))}
        </div>
      </div>
    </section>
  );
}
