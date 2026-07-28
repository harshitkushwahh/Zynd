"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  getPortfolioChartSeries,
  PORTFOLIO_CHART_PERIODS,
  portfolioChartPeriodDescription,
  portfolioChartPeriodTabLabel,
  type PortfolioChartPeriod,
  type PortfolioChartPoint,
} from "@/lib/client-portfolio-chart-data";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 240;

type ChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string; payload?: PortfolioChartPoint }>;
  label?: string | number;
};

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-sm">
      {label ? <p className="text-caption text-muted-foreground">{label}</p> : null}
      <p className="text-compact font-semibold tabular-nums text-foreground">{formatAum(value)}</p>
    </div>
  );
}

function renderChartTooltip(props: unknown) {
  return <ChartTooltip {...(props as ChartTooltipProps)} />;
}

function yDomain(points: PortfolioChartPoint[]): [number, number] {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values, 1);
  const pad = (max - min) * 0.08 || max * 0.08;
  return [Math.max(0, min - pad), max + pad];
}

type ClientPortfolioValueChartProps = {
  clientId: string;
  currentValue: number;
  className?: string;
};

export function ClientPortfolioValueChart({
  clientId,
  currentValue,
  className,
}: ClientPortfolioValueChartProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.portfolio;
  const [period, setPeriod] = useState<PortfolioChartPeriod>("1Y");
  const gradientId = useId().replace(/:/g, "");

  const series = useMemo(
    () => getPortfolioChartSeries(clientId, currentValue, period),
    [clientId, currentValue, period],
  );

  const domain = useMemo(() => yDomain(series), [series]);
  const tickInterval = Math.max(0, Math.floor(series.length / 6) - 1);
  const isEmpty = currentValue <= 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-border bg-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 py-4">
        <div>
          <p className="text-compact font-medium text-foreground">{copy.chartTitle}</p>
          <p className="text-caption text-muted-foreground">
            {portfolioChartPeriodDescription(period)}
          </p>
        </div>
        <p className="text-compact font-semibold tabular-nums text-foreground">
          {formatAum(currentValue)}
        </p>
      </div>

      {isEmpty ? (
        <div className="mx-4 mb-4 flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center text-caption text-muted-foreground">
          {copy.chartEmpty}
        </div>
      ) : (
        <>
          <div
            className="h-[240px] w-full min-w-0 [&_.recharts-cartesian-grid]:overflow-visible [&_.recharts-surface]:overflow-visible"
            role="img"
            aria-label={copy.chartTitle}
          >
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
              <AreaChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={20}
                  interval={tickInterval}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis domain={domain} hide />
                <Tooltip
                  content={renderChartTooltip}
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: "var(--card)", stroke: "var(--primary)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-border px-4 py-3">
            <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PORTFOLIO_CHART_PERIODS.map((tab) => {
                const active = period === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPeriod(tab)}
                    className={cn(
                      "min-w-[2.75rem] shrink-0 flex-1 rounded-md px-2 py-2 text-caption font-medium transition-colors sm:min-w-0",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={active}
                  >
                    {portfolioChartPeriodTabLabel(tab)}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
