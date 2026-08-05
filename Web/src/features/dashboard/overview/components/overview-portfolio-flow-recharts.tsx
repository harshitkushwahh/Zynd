"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { OverviewPortfolioFlowPoint } from "@/features/dashboard/overview/lib/overview-portfolio-flow-series";

type OverviewPortfolioFlowRechartsProps = {
  points: OverviewPortfolioFlowPoint[];
  valueGradientId: string;
  yDomain: [number, number];
  baseValue: number;
  renderTooltip: (props: unknown) => ReactNode;
  chartHeight: number;
  chartEdgeInset: number;
  chartDotRadius: number;
  chartDotStroke: number;
  chartAnimationMs: number;
};

export function OverviewPortfolioFlowRecharts({
  points,
  valueGradientId,
  yDomain,
  baseValue,
  renderTooltip,
  chartHeight,
  chartEdgeInset,
  chartDotRadius,
  chartDotStroke,
  chartAnimationMs,
}: OverviewPortfolioFlowRechartsProps) {
  return (
    <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
      <AreaChart
        data={points}
        margin={{
          top: chartEdgeInset,
          right: chartEdgeInset,
          left: chartEdgeInset,
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
          padding={{ left: chartEdgeInset, right: chartEdgeInset }}
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
          content={renderTooltip}
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
            r: chartDotRadius + 1,
            fill: "var(--zynd-emerald)",
            stroke: "var(--card)",
            strokeWidth: chartDotStroke,
          }}
          isAnimationActive
          animationDuration={chartAnimationMs}
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
            r: chartDotRadius,
            fill: "var(--zynd-blue)",
            stroke: "var(--card)",
            strokeWidth: chartDotStroke,
          }}
          isAnimationActive
          animationDuration={chartAnimationMs}
          animationEasing="ease-in-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
