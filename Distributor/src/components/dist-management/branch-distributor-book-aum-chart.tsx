"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { IndianRupee } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getPortfolioChartSeries,
  portfolioChartPeriodTabLabel,
  type PortfolioChartPeriod,
  type PortfolioChartPoint,
} from "@/lib/client-portfolio-chart-data";
import { DistributorGrowthBadge } from "@/components/ui/distributor-growth-badge";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

const BOOK_AUM_CHART_PERIODS: PortfolioChartPeriod[] = ["6M", "1Y", "3Y", "5Y", "10Y"];

type BookAumChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string; payload?: PortfolioChartPoint }>;
  label?: string | number;
};

function BookAumChartTooltip({ active, payload, label }: BookAumChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-2.5 py-1.5 shadow-sm">
      {label ? <p className="text-micro text-muted-foreground">{label}</p> : null}
      <p className="text-caption font-semibold tabular-nums text-foreground">{formatAum(value)}</p>
    </div>
  );
}

function renderBookAumChartTooltip(props: unknown) {
  return <BookAumChartTooltip {...(props as BookAumChartTooltipProps)} />;
}

function chartDomain(points: PortfolioChartPoint[]): [number, number] {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values, 1);
  const pad = (max - min) * 0.12 || max * 0.08;
  return [Math.max(0, min - pad), max + pad];
}

type BranchDistributorBookAumChartProps = {
  distributorId: string;
  currentAum: number;
  investedAmount: number;
  className?: string;
};

export function BranchDistributorBookAumChart({
  distributorId,
  currentAum,
  investedAmount,
  className,
}: BranchDistributorBookAumChartProps) {
  const [period, setPeriod] = useState<PortfolioChartPeriod>("1Y");
  const gradientId = useId().replace(/:/g, "");

  const series = useMemo(
    () => getPortfolioChartSeries(distributorId, currentAum, period, investedAmount),
    [currentAum, distributorId, investedAmount, period],
  );

  const domain = useMemo(() => chartDomain(series), [series]);
  const tickInterval = Math.max(0, Math.floor(series.length / 5) - 1);

  const firstValue = series[0]?.value ?? currentAum;
  const lastValue = series[series.length - 1]?.value ?? currentAum;
  const changePct = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  return (
    <article
      className={cn("distributor-branch-distributor-book-aum-chart", className)}
      aria-label="Book AUM trend"
    >
      <div className="distributor-branch-distributor-book-aum-chart__head">
        <div className="distributor-branch-distributor-book-aum-chart__metric">
          <span className="distributor-branch-distributor-book-aum-chart__metric-icon" aria-hidden>
            <IndianRupee className="size-4" strokeWidth={2.25} />
          </span>
          <div className="distributor-branch-distributor-book-aum-chart__metric-copy">
            <div className="distributor-branch-distributor-book-aum-chart__metric-headline">
              <span className="distributor-branch-distributor-book-aum-chart__metric-value tabular-nums">
                {formatAum(currentAum)}
              </span>
              {series.length > 1 ? (
                <DistributorGrowthBadge value={changePct} />
              ) : null}
            </div>
            <p className="distributor-branch-distributor-book-aum-chart__metric-label">Total AUM · book</p>
          </div>
        </div>

        <div
          className="distributor-branch-distributor-book-aum-chart__period-tabs"
          role="tablist"
          aria-label="Book AUM chart period"
        >
          {BOOK_AUM_CHART_PERIODS.map((option, index) => {
            const selected = option === period;
            return (
              <Fragment key={option}>
                {index > 0 ? (
                  <span
                    className="distributor-branch-distributor-book-aum-chart__period-tab-divider"
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={cn(
                    "distributor-branch-distributor-book-aum-chart__period-tab",
                    selected && "distributor-branch-distributor-book-aum-chart__period-tab--active",
                  )}
                  onClick={() => setPeriod(option)}
                >
                  {portfolioChartPeriodTabLabel(option)}
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>

      <div
        className="distributor-branch-distributor-book-aum-chart__plot"
        role="img"
        aria-label={`Book AUM trend for ${portfolioChartPeriodTabLabel(period)}`}
      >
        {series.length === 0 ? (
          <p className="distributor-branch-distributor-book-aum-chart__empty text-caption text-muted-foreground">
            No AUM history for this book yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                interval={tickInterval}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              />
              <YAxis domain={domain} hide />
              <Tooltip
                content={renderBookAumChartTooltip}
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--foreground)"
                strokeWidth={1.75}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{
                  r: 3.5,
                  strokeWidth: 2,
                  fill: "var(--card)",
                  stroke: "var(--foreground)",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </article>
  );
}
