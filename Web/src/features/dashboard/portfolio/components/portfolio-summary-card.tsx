"use client";

import { useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";

import {
  filterPortfolioFlowByRange,
  OVERVIEW_PORTFOLIO_FLOW_RANGE_OPTIONS,
  type OverviewPortfolioFlowPoint,
  type OverviewPortfolioFlowRange,
} from "@/features/dashboard/overview/lib/overview-portfolio-flow-series";
import type { OverviewPortfolioPreview } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function toneClass(tone: "positive" | "negative" | "muted") {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-destructive",
    tone === "muted" && "text-muted-foreground",
  );
}

function PortfolioSparkline({ points }: { points: OverviewPortfolioFlowPoint[] }) {
  const { linePath, areaPath } = useMemo(() => {
    if (points.length < 2) {
      return { linePath: "", areaPath: "" };
    }

    const width = 320;
    const height = 108;
    const padX = 8;
    const padY = 10;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 1);

    const coords = points.map((point, index) => {
      const x = padX + (index / (points.length - 1)) * (width - padX * 2);
      const y = padY + (1 - (point.value - min) / span) * (height - padY * 2);
      return { x, y };
    });

    const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    const areaPath = `${linePath} L ${coords[coords.length - 1]!.x} ${height} L ${coords[0]!.x} ${height} Z`;

    return { linePath, areaPath };
  }, [points]);

  if (!linePath) {
    return <div className="h-[6.75rem] w-full rounded-[var(--radius-control)] bg-muted/30" aria-hidden />;
  }

  return (
    <svg
      viewBox="0 0 320 108"
      preserveAspectRatio="none"
      className="h-[6.75rem] w-full overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id="portfolio-sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--zynd-emerald)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--zynd-emerald)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#portfolio-sparkline-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--zynd-emerald)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PortfolioRangeTabs({
  value,
  onChange,
}: {
  value: OverviewPortfolioFlowRange;
  onChange: (value: OverviewPortfolioFlowRange) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={copy.dashboard.overview.portfolioChartRangeLabel}
      className="flex flex-wrap justify-center gap-0.5 px-2 pb-2 pt-1"
    >
      {OVERVIEW_PORTFOLIO_FLOW_RANGE_OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "min-w-[2.15rem] rounded-full px-2 py-1 text-[10px] font-medium transition-all duration-200 ease-out sm:min-w-[2.35rem] sm:px-2.5 sm:text-[11px]",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type PortfolioSummaryCardProps = {
  data: OverviewPortfolioPreview;
  series: readonly OverviewPortfolioFlowPoint[];
  showDayChange?: boolean;
  className?: string;
};

export function PortfolioSummaryCard({
  data,
  series,
  showDayChange = true,
  className,
}: PortfolioSummaryCardProps) {
  const overview = copy.dashboard.overview;
  const totalReturn = formatSignedReturn(data.totalReturnPct);
  const dayChange = formatSignedReturn(data.dayChangePct);
  const [range, setRange] = useState<OverviewPortfolioFlowRange>("1y");
  const chartPoints = useMemo(() => filterPortfolioFlowByRange(series, range), [range, series]);

  return (
    <section
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "flex min-h-[13.5rem] min-w-0 flex-col overflow-hidden border border-border/60 bg-card",
        className,
      )}
    >
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
                <ArrowUp className="size-3.5" strokeWidth={2.5} aria-hidden />
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-caption">
          <span className={cn("font-semibold tabular-nums", toneClass(totalReturn.tone))}>
            {formatInr(data.totalReturnInr)} ({totalReturn.text})
          </span>
          {showDayChange ? (
            <>
              <span className="text-muted-foreground">·</span>
              <span className={cn("font-medium tabular-nums", toneClass(dayChange.tone))}>
                {dayChange.text} today · {formatInr(data.dayChangeInr)}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-auto px-1 pt-3 sm:px-2">
        <PortfolioSparkline points={chartPoints} />
        <PortfolioRangeTabs value={range} onChange={setRange} />
      </div>
    </section>
  );
}
