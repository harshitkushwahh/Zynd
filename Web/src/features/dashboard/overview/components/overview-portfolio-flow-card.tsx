"use client";

import { useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { OverviewPortfolioFlowChart } from "@/features/dashboard/overview/components/overview-portfolio-flow-chart";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import {
  filterPortfolioFlowByRange,
  type OverviewPortfolioFlowPoint,
  type OverviewPortfolioFlowRange,
} from "@/features/dashboard/overview/lib/overview-portfolio-flow-series";
import {
  OVERVIEW_PORTFOLIO_FLOW_LOCKED_SERIES,
  OVERVIEW_PORTFOLIO_LOCKED_PREVIEW,
} from "@/features/dashboard/overview/lib/overview-locked-preview-data";
import type { OverviewPortfolioPreview } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type OverviewPortfolioFlowCardProps = {
  data?: OverviewPortfolioPreview | null;
  series?: readonly OverviewPortfolioFlowPoint[];
  className?: string;
};

function toneClass(tone: "positive" | "negative" | "muted") {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-destructive",
    tone === "muted" && "text-muted-foreground",
  );
}

function PortfolioFlowCardBody({
  data,
  series,
  locked = false,
}: {
  data: OverviewPortfolioPreview;
  series: readonly OverviewPortfolioFlowPoint[];
  locked?: boolean;
}) {
  const overview = copy.dashboard.overview;
  const totalReturn = formatSignedReturn(data.totalReturnPct);
  const dayChange = formatSignedReturn(data.dayChangePct);
  const [range, setRange] = useState<OverviewPortfolioFlowRange>("1y");
  const chartPoints = useMemo(
    () => filterPortfolioFlowByRange(series, range),
    [range, series],
  );

  return (
    <>
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">{overview.portfolioCurrentValue}</p>
            <p className="mt-1 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[2rem]">
              {formatInr(data.currentValueInr)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className={cn("text-compact font-semibold tabular-nums", toneClass(totalReturn.tone))}>
              {totalReturn.text}
            </span>
            {totalReturn.tone === "positive" ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-success text-white">
                <ArrowUp className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-caption">
          <span className={cn("font-semibold tabular-nums", toneClass(totalReturn.tone))}>
            {formatInr(data.totalReturnInr)} ({totalReturn.text})
          </span>
          <span className="text-muted-foreground">·</span>
          <span className={cn("font-medium tabular-nums", toneClass(dayChange.tone))}>
            {dayChange.text} today · {formatInr(data.dayChangeInr)}
          </span>
        </div>
      </div>

      <div className={cn("mt-auto px-1 pt-3 sm:px-2", locked && "pointer-events-none select-none")}>
        <OverviewPortfolioFlowChart
          points={chartPoints}
          range={range}
          onRangeChange={locked ? () => undefined : setRange}
        />
      </div>
    </>
  );
}

export function OverviewPortfolioFlowCard({
  data = null,
  series = [],
  className,
}: OverviewPortfolioFlowCardProps) {
  const overview = copy.dashboard.overview;
  const hasData = Boolean(data && series.length > 0);
  const previewData = OVERVIEW_PORTFOLIO_LOCKED_PREVIEW;
  const previewSeries = OVERVIEW_PORTFOLIO_FLOW_LOCKED_SERIES;

  return (
    <section
      className={cn(
        "flex min-h-[13.5rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card",
        className,
      )}
    >
      {hasData && data ? (
        <PortfolioFlowCardBody data={data} series={series} />
      ) : (
        <div className="relative flex min-h-[13.5rem] flex-1 flex-col">
          <div className="flex flex-1 flex-col blur-[5px]">
            <PortfolioFlowCardBody
              data={previewData}
              series={previewSeries}
              locked
            />
          </div>
          <OverviewLockedCardBackdrop />
          <OverviewLockedCardOverlay
            title={overview.portfolioTitle}
            subtitle={overview.portfolioFlowEmpty}
          />
        </div>
      )}
    </section>
  );
}

export function OverviewPortfolioFlowCardSkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "flex min-h-[13.5rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card",
        className,
      )}
      aria-hidden="true"
    >
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
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
