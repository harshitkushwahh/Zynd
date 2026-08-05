"use client";

import dynamic from "next/dynamic";
import { useId, useMemo } from "react";

import {
  filterPortfolioFlowByRange,
  OVERVIEW_PORTFOLIO_FLOW_RANGE_OPTIONS,
  portfolioFlowYDomain,
  type OverviewPortfolioFlowPoint,
  type OverviewPortfolioFlowRange,
} from "@/features/dashboard/overview/lib/overview-portfolio-flow-series";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 108;
const CHART_DOT_RADIUS = 3.5;
const CHART_DOT_STROKE = 2;
const CHART_EDGE_INSET = CHART_DOT_RADIUS + CHART_DOT_STROKE + 4;
const CHART_ANIMATION_MS = 480;

type PortfolioFlowTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    value?: number | string;
    dataKey?: string;
    payload?: OverviewPortfolioFlowPoint;
  }>;
  label?: string | number;
};

function PortfolioFlowTooltipRow({
  tone,
  label,
  value,
}: {
  tone: "value" | "invested";
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            tone === "value" ? "bg-[var(--zynd-emerald)]" : "bg-[var(--zynd-blue)]",
          )}
          aria-hidden="true"
        />
        <span className="truncate text-[9px] text-muted-foreground">{label}</span>
      </div>
      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function PortfolioFlowTooltip({ active, payload, label }: PortfolioFlowTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  const overview = copy.dashboard.overview;
  const gainInr = point.value - point.invested;
  const gainPct = point.invested > 0 ? (gainInr / point.invested) * 100 : 0;
  const gainDisplay = formatSignedReturn(gainPct);

  return (
    <div className="pointer-events-none w-[8.75rem] overflow-hidden rounded-md border border-border/70 bg-popover/95 px-2 py-1.5 shadow-zynd-mid backdrop-blur-sm">
      {label ? (
        <p className="truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      ) : null}

      <div className={cn("space-y-0.5", label && "mt-1")}>
        <PortfolioFlowTooltipRow
          tone="value"
          label={overview.portfolioCurrentValue}
          value={formatInr(point.value)}
        />
        <PortfolioFlowTooltipRow
          tone="invested"
          label={overview.portfolioInvested}
          value={formatInr(point.invested)}
        />
      </div>

      <div className="mt-1 border-t border-border/50 pt-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[9px] text-muted-foreground">{overview.portfolioFlowTooltipGain}</span>
          <span
            className={cn(
              "text-[10px] font-semibold tabular-nums",
              gainDisplay.tone === "positive" && "text-success",
              gainDisplay.tone === "negative" && "text-destructive",
              gainDisplay.tone === "muted" && "text-muted-foreground",
            )}
          >
            {formatInr(gainInr)} ({gainDisplay.text})
          </span>
        </div>
      </div>
    </div>
  );
}

function renderPortfolioFlowTooltip(props: unknown) {
  return <PortfolioFlowTooltip {...(props as PortfolioFlowTooltipProps)} />;
}

function PortfolioFlowRangeTabs({
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

const PortfolioFlowRecharts = dynamic(
  () =>
    import("./overview-portfolio-flow-recharts").then((mod) => mod.OverviewPortfolioFlowRecharts),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[6.75rem] w-full animate-pulse rounded-[var(--radius-control)] bg-muted/40"
        aria-hidden="true"
      />
    ),
  },
);

export function OverviewPortfolioFlowChart({
  points,
  range,
  onRangeChange,
}: {
  points: OverviewPortfolioFlowPoint[];
  range: OverviewPortfolioFlowRange;
  onRangeChange: (range: OverviewPortfolioFlowRange) => void;
}) {
  const valueGradientId = useId().replace(/:/g, "");
  const yDomain = useMemo(() => portfolioFlowYDomain(points), [points]);
  const baseValue = yDomain[0];

  return (
    <div className="w-full min-w-0">
      <div className="h-[6.75rem] w-full transition-opacity duration-300 ease-out [&_.recharts-cartesian-grid]:overflow-visible [&_.recharts-surface]:overflow-visible">
        <PortfolioFlowRecharts
          points={points}
          valueGradientId={valueGradientId}
          yDomain={yDomain}
          baseValue={baseValue}
          renderTooltip={renderPortfolioFlowTooltip}
          chartHeight={CHART_HEIGHT}
          chartEdgeInset={CHART_EDGE_INSET}
          chartDotRadius={CHART_DOT_RADIUS}
          chartDotStroke={CHART_DOT_STROKE}
          chartAnimationMs={CHART_ANIMATION_MS}
        />
      </div>

      <PortfolioFlowRangeTabs value={range} onChange={onRangeChange} />
    </div>
  );
}
