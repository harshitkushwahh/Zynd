"use client";

import { useId, useMemo } from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

import { RechartsMeasuredContainer } from "@/components/ui/recharts-measured-container";

import type { MfInvestedDayPoint } from "@/features/invest/lib/mf-dashboard-sidebar-data";

type InvestedChartTone = "positive" | "negative" | "muted";

type MfYourInvestedChartProps = {
  points: MfInvestedDayPoint[];
  tone: InvestedChartTone;
  className?: string;
};

const CHART_HEIGHT = 56;

const CHART_COLORS: Record<InvestedChartTone, string> = {
  positive: "var(--zynd-emerald)",
  negative: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground))",
};

export function MfYourInvestedChart({ points, tone, className }: MfYourInvestedChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const strokeColor = CHART_COLORS[tone];

  const yDomain = useMemo(() => {
    const values = points.map((point) => point.value);
    if (values.length === 0) return [0, 1] as [number, number];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.12 || max * 0.02 || 1;

    return [min - padding, max + padding] as [number, number];
  }, [points]);

  if (points.length < 2) return null;

  return (
    <div className={className} style={{ height: CHART_HEIGHT }}>
      <RechartsMeasuredContainer className="h-full w-full" width="100%" height={CHART_HEIGHT} minWidth={0}>
        <AreaChart data={points} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis dataKey="label" hide padding={{ left: 0, right: 0 }} />
          <YAxis hide domain={yDomain} width={0} allowDataOverflow={false} />

          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={false}
            isAnimationActive
            animationDuration={650}
            animationEasing="ease-out"
          />
        </AreaChart>
      </RechartsMeasuredContainer>
    </div>
  );
}

export function investedChartTone(dayChangePct: number): InvestedChartTone {
  if (dayChangePct > 0) return "positive";
  if (dayChangePct < 0) return "negative";
  return "muted";
}
