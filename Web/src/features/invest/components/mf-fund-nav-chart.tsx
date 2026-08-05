"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MfNavChartPoint } from "@/features/invest/lib/mf-nav-history";
import { formatNav, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { MF_FUND_DETAIL_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 300;

type NavChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string; payload?: MfNavChartPoint }>;
  startNav?: number | null;
};

function NavChartTooltip({ active, payload, startNav }: NavChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const changePct =
    startNav != null && startNav > 0 ? ((point.nav / startNav) - 1) * 100 : null;
  const changeDisplay = formatSignedReturn(changePct);

  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-zynd-mid">
      <p className="text-caption text-muted-foreground">{point.label}</p>
      <p className="text-compact font-semibold tabular-nums text-foreground">
        NAV {formatNav(point.nav)}
      </p>
      {changePct != null ? (
        <p
          className={cn(
            "text-caption font-medium tabular-nums",
            changeDisplay.tone === "positive" && "text-success",
            changeDisplay.tone === "negative" && "text-destructive",
            changeDisplay.tone === "muted" && "text-muted-foreground",
          )}
        >
          {changeDisplay.text}
        </p>
      ) : null}
    </div>
  );
}

function renderNavTooltip(startNav: number | null) {
  return function NavTooltipRenderer(props: unknown) {
    return <NavChartTooltip {...(props as NavChartTooltipProps)} startNav={startNav} />;
  };
}

function yDomain(points: MfNavChartPoint[]): [number, number] {
  const values = points.map((point) => point.nav);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.1, min * 0.002);
  return [Math.max(0, min - padding), max + padding];
}

function chartTone(periodReturn: number | null | undefined): "positive" | "negative" | "neutral" {
  if (periodReturn == null) return "neutral";
  if (periodReturn > 0) return "positive";
  if (periodReturn < 0) return "negative";
  return "neutral";
}

const CHART_TONE_STYLES = {
  positive: {
    stroke: "var(--success)",
    fillColor: "var(--success)",
    fillStartOpacity: 0.32,
    fillEndOpacity: 0.04,
    cursor: "color-mix(in srgb, var(--success) 35%, transparent)",
  },
  negative: {
    stroke: "var(--destructive)",
    fillColor: "var(--destructive)",
    fillStartOpacity: 0.28,
    fillEndOpacity: 0.04,
    cursor: "color-mix(in srgb, var(--destructive) 35%, transparent)",
  },
  neutral: {
    stroke: "var(--primary)",
    fillColor: "var(--primary)",
    fillStartOpacity: 0.28,
    fillEndOpacity: 0.02,
    cursor: "color-mix(in srgb, var(--primary) 35%, transparent)",
  },
} as const;

type MfFundNavChartProps = {
  points: MfNavChartPoint[];
  periodReturn?: number | null;
};

export function MfFundNavChart({ points, periodReturn }: MfFundNavChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const domain = useMemo(() => yDomain(points), [points]);
  const startNav = points[0]?.nav ?? null;
  const tone = chartTone(periodReturn);
  const toneStyles = CHART_TONE_STYLES[tone];

  if (points.length < 2) {
    return (
      <div
        className={cn(
          "flex min-h-[240px] items-center justify-center border border-dashed border-border bg-muted/10 px-6 text-center",
          MF_FUND_DETAIL_RADIUS_CLASS,
        )}
      >
        <p className="text-compact text-muted-foreground">{copy.mutualFunds.navChartEmpty}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden border border-border/70 bg-muted/10",
        MF_FUND_DETAIL_RADIUS_CLASS,
      )}
    >
      <div className="h-[300px] w-full min-w-0 [&_.recharts-cartesian-grid]:overflow-visible [&_.recharts-surface]:overflow-visible">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <AreaChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={toneStyles.fillColor}
                  stopOpacity={toneStyles.fillStartOpacity}
                />
                <stop
                  offset="100%"
                  stopColor={toneStyles.fillColor}
                  stopOpacity={toneStyles.fillEndOpacity}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="color-mix(in srgb, var(--border) 80%, transparent)"
              strokeDasharray="3 6"
              vertical={false}
            />
            <XAxis dataKey="date" hide />
            <YAxis domain={domain} hide />
            <Tooltip
              content={renderNavTooltip(startNav)}
              cursor={{ stroke: toneStyles.cursor, strokeWidth: 1.5, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="nav"
              stroke={toneStyles.stroke}
              strokeWidth={2.25}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 5,
                strokeWidth: 2.5,
                stroke: toneStyles.stroke,
                fill: "var(--card)",
              }}
              isAnimationActive
              animationDuration={450}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
