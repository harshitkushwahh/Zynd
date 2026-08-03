"use client";

import { useId, useMemo, useState } from "react";
import { ArrowUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import {
  filterPortfolioFlowByRange,
  OVERVIEW_PORTFOLIO_FLOW_RANGE_OPTIONS,
  OVERVIEW_PORTFOLIO_FLOW_SERIES,
  portfolioFlowYDomain,
  type OverviewPortfolioFlowPoint,
  type OverviewPortfolioFlowRange,
} from "@/features/dashboard/overview/lib/overview-portfolio-flow-series";
import {
  OVERVIEW_PORTFOLIO_PREVIEW,
  type OverviewPortfolioPreview,
} from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type OverviewPortfolioFlowCardProps = {
  data?: OverviewPortfolioPreview;
  series?: readonly OverviewPortfolioFlowPoint[];
  className?: string;
};

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

function PortfolioFlowChart({
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
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <AreaChart
            data={points}
            margin={{
              top: CHART_EDGE_INSET,
              right: CHART_EDGE_INSET,
              left: CHART_EDGE_INSET,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id={valueGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--zynd-emerald)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--zynd-emerald)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="label"
              hide
              padding={{ left: CHART_EDGE_INSET, right: CHART_EDGE_INSET }}
            />
            <YAxis hide domain={yDomain} width={0} allowDataOverflow={false} />

            <Tooltip
              animationDuration={200}
              wrapperStyle={{ outline: "none", zIndex: 20 }}
              cursor={{
                stroke: "var(--zynd-emerald)",
                strokeOpacity: 0.28,
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
              content={renderPortfolioFlowTooltip}
            />

            <Area
              type="monotone"
              dataKey="value"
              baseValue={baseValue}
              stroke="var(--zynd-emerald)"
              strokeWidth={2}
              fill={`url(#${valueGradientId})`}
              dot={false}
              activeDot={{
                r: CHART_DOT_RADIUS + 1,
                fill: "var(--zynd-emerald)",
                stroke: "var(--card)",
                strokeWidth: CHART_DOT_STROKE,
              }}
              isAnimationActive
              animationDuration={CHART_ANIMATION_MS}
              animationEasing="ease-in-out"
            />

            <Line
              type="monotone"
              dataKey="invested"
              stroke="var(--zynd-blue)"
              strokeWidth={1.75}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{
                r: CHART_DOT_RADIUS,
                fill: "var(--zynd-blue)",
                stroke: "var(--card)",
                strokeWidth: CHART_DOT_STROKE,
              }}
              isAnimationActive
              animationDuration={CHART_ANIMATION_MS}
              animationEasing="ease-in-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <PortfolioFlowRangeTabs value={range} onChange={onRangeChange} />
    </div>
  );
}

function toneClass(tone: "positive" | "negative" | "muted") {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-destructive",
    tone === "muted" && "text-muted-foreground",
  );
}

export function OverviewPortfolioFlowCard({
  data = OVERVIEW_PORTFOLIO_PREVIEW,
  series = OVERVIEW_PORTFOLIO_FLOW_SERIES,
  className,
}: OverviewPortfolioFlowCardProps) {
  const overview = copy.dashboard.overview;
  const totalReturn = formatSignedReturn(data.totalReturnPct);
  const dayChange = formatSignedReturn(data.dayChangePct);
  const [range, setRange] = useState<OverviewPortfolioFlowRange>("1y");
  const chartPoints = useMemo(
    () => filterPortfolioFlowByRange(series, range),
    [range, series],
  );

  return (
    <section
      className={cn(
        "flex min-h-[13.5rem] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card",
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

      <div className="mt-auto px-1 pt-3 sm:px-2">
        <PortfolioFlowChart points={chartPoints} range={range} onRangeChange={setRange} />
      </div>
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
