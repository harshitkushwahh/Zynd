"use client";

import { useId, useMemo, type ReactNode } from "react";
import { Lock, Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RechartsMeasuredContainer } from "@/components/ui/recharts-measured-container";

import type { CalculatorChartSeriesPoint } from "@/features/invest/lib/mf-lumpsum-calculator";
import { MF_CALC_GAIN_TEXT_CLASS, MF_CALC_ICON_BADGE_CLASS } from "@/features/invest/lib/mf-calculator-ui";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 320;

export type MfCalculatorChartLabels = {
  value: string;
  invested: string;
  gain: string;
  empty: string;
  lockedTitle: string;
  lockedMessage: string;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CalculatorChartSeriesPoint }>;
  label?: string | number;
  labels: MfCalculatorChartLabels;
};

function ChartTooltip({ active, payload, label, labels }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-zynd-mid">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-compact font-semibold text-foreground">
        {labels.value}: {formatInr(point.value)}
      </p>
      <p className="text-caption text-muted-foreground">
        {labels.invested}: {formatInr(point.invested)}
      </p>
      <p className={cn("text-caption", MF_CALC_GAIN_TEXT_CLASS)}>
        {labels.gain}: {formatInr(point.gain)}
      </p>
    </div>
  );
}

function yDomain(points: CalculatorChartSeriesPoint[]): [number, number] {
  const values = points.flatMap((point) => [point.value, point.invested]);
  const max = Math.max(...values, 1);
  return [0, max * 1.08];
}

type MfCalculatorProjectionChartProps = {
  series: readonly CalculatorChartSeriesPoint[];
  labels: MfCalculatorChartLabels;
  interactive?: boolean;
  emptyMessage?: string;
};

export function MfCalculatorProjectionChart({
  series,
  labels,
  interactive = true,
  emptyMessage,
}: MfCalculatorProjectionChartProps) {
  const gradientInvestedId = useId().replace(/:/g, "");
  const gradientGainId = useId().replace(/:/g, "");
  const domain = useMemo(() => yDomain([...series]), [series]);

  if (series.length < 2) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border px-6 text-center">
        <p className="text-compact text-muted-foreground">{emptyMessage ?? labels.empty}</p>
      </div>
    );
  }

  const tickInterval = Math.max(1, Math.floor(series.length / 6));

  return (
    <div
      className="h-[320px] w-full min-w-0 [&_.recharts-cartesian-grid]:overflow-visible [&_.recharts-surface]:overflow-visible"
      aria-hidden={!interactive}
    >
      <RechartsMeasuredContainer className="h-full w-full" width="100%" height={CHART_HEIGHT} minWidth={0}>
        <AreaChart data={[...series]} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientInvestedId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sip-chart-invested-fill-start)" />
              <stop offset="100%" stopColor="var(--sip-chart-invested-fill-end)" />
            </linearGradient>
            <linearGradient id={gradientGainId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sip-chart-gain-fill-start)" />
              <stop offset="100%" stopColor="var(--sip-chart-gain-fill-end)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            interval={tickInterval}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            domain={domain}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(value) => formatInr(Number(value), { compact: true })}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          {interactive ? (
            <Tooltip
              content={(props) => (
                <ChartTooltip {...(props as ChartTooltipProps)} labels={labels} />
              )}
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="invested"
            stackId="corpus"
            stroke="var(--sip-chart-invested-stroke)"
            strokeWidth={1.5}
            fill={`url(#${gradientInvestedId})`}
            dot={false}
            activeDot={false}
            isAnimationActive={interactive}
          />
          <Area
            type="monotone"
            dataKey="gain"
            stackId="corpus"
            stroke="var(--sip-chart-gain-stroke)"
            strokeWidth={2}
            fill={`url(#${gradientGainId})`}
            dot={false}
            activeDot={interactive ? { r: 4, strokeWidth: 2, fill: "var(--card)" } : false}
            isAnimationActive={interactive}
          />
        </AreaChart>
      </RechartsMeasuredContainer>
    </div>
  );
}

type MfCalculatorProjectionChartPanelProps = {
  series: readonly CalculatorChartSeriesPoint[];
  labels: MfCalculatorChartLabels;
  locked?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  disclaimer?: ReactNode;
};

export function MfCalculatorProjectionChartPanel({
  series,
  labels,
  locked = false,
  loading = false,
  emptyMessage,
  disclaimer,
}: MfCalculatorProjectionChartPanelProps) {
  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border px-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {copy.mutualFunds.calculatorLoading}
        </div>
      </div>
    );
  }

  if (!locked && series.length < 2) {
    return (
      <MfCalculatorProjectionChart
        series={series}
        labels={labels}
        emptyMessage={emptyMessage}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div
          className={cn(
            "transition-[filter]",
            locked && "pointer-events-none select-none blur-[5px]",
          )}
        >
          <MfCalculatorProjectionChart series={series} labels={labels} interactive={!locked} />
        </div>
        {locked ? (
          <>
            <div className="pointer-events-none absolute inset-0 sip-chart-overlay" aria-hidden />
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <div className="flex max-w-md items-center gap-3 px-4 py-3 shadow-zynd-mid backdrop-blur-sm sip-lock-panel">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    MF_CALC_ICON_BADGE_CLASS,
                  )}
                >
                  <Lock className="size-4" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-compact font-semibold text-foreground">{labels.lockedTitle}</p>
                  <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
                    {labels.lockedMessage}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
      {disclaimer}
    </div>
  );
}
