"use client";

import { useMemo, useState } from "react";
import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

import type { OperationsDualRingMetrics } from "@/lib/your-operations-dual-ring";
import { cn } from "@/lib/utils";

const OUTER_FILL = "#6d28d9";
const INNER_FILL = "#22c55e";
const TRACK_FILL = "#ececf4";

type DistributorOperationsDualRingCardProps = {
  metrics: OperationsDualRingMetrics;
  className?: string;
};

export function DistributorOperationsDualRingCard({
  metrics,
  className,
}: DistributorOperationsDualRingCardProps) {
  const [hovered, setHovered] = useState<"outer" | "inner" | null>(null);

  const outerData = useMemo(
    () => [{ name: metrics.outerLabel, value: metrics.outerPct, ratio: metrics.outerRatio }],
    [metrics],
  );

  const innerData = useMemo(
    () => [{ name: metrics.innerLabel, value: metrics.innerPct, ratio: metrics.innerRatio }],
    [metrics],
  );

  return (
    <article
      className={cn("distributor-orders-dual-ring", className)}
      aria-label={`${metrics.outerPct} percent ${metrics.outerLabel}, ${metrics.innerPct} percent ${metrics.innerLabel}`}
    >
      <div className="distributor-orders-dual-ring__stats">
        <div className="distributor-orders-dual-ring__stat">
          <p className="distributor-orders-dual-ring__stat-value tabular-nums">{metrics.outerPct}%</p>
          <p className="distributor-orders-dual-ring__stat-label">{metrics.outerLabel}</p>
        </div>
        <div className="distributor-orders-dual-ring__stat">
          <p className="distributor-orders-dual-ring__stat-value tabular-nums">{metrics.innerPct}%</p>
          <p className="distributor-orders-dual-ring__stat-label">{metrics.innerLabel}</p>
        </div>
      </div>

      <div
        className="distributor-orders-dual-ring__chart"
        onMouseLeave={() => setHovered(null)}
        role="img"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="100%"
            barSize={12}
            data={outerData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              background={{ fill: TRACK_FILL }}
              dataKey="value"
              cornerRadius={999}
              fill={OUTER_FILL}
              onMouseEnter={() => setHovered("outer")}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        <div className="distributor-orders-dual-ring__chart-inner">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="88%"
              barSize={10}
              data={innerData}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar
                background={{ fill: TRACK_FILL }}
                dataKey="value"
                cornerRadius={999}
                fill={INNER_FILL}
                onMouseEnter={() => setHovered("inner")}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {hovered === "outer" ? (
          <div className="distributor-orders-dual-ring__float-tip distributor-orders-dual-ring__float-tip--outer">
            <span className="distributor-orders-dual-ring__float-dot" style={{ background: OUTER_FILL }} />
            <div>
              <p className="distributor-orders-dual-ring__float-title">{metrics.outerLabel}</p>
              <p className="distributor-orders-dual-ring__float-meta tabular-nums">{metrics.outerRatio}</p>
            </div>
          </div>
        ) : null}

        {hovered === "inner" ? (
          <div className="distributor-orders-dual-ring__float-tip distributor-orders-dual-ring__float-tip--inner">
            <span className="distributor-orders-dual-ring__float-dot" style={{ background: INNER_FILL }} />
            <div>
              <p className="distributor-orders-dual-ring__float-title">{metrics.innerLabel}</p>
              <p className="distributor-orders-dual-ring__float-meta tabular-nums">{metrics.innerRatio}</p>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** @deprecated Use DistributorOperationsDualRingCard */
export const DistributorOrdersDualRingCard = DistributorOperationsDualRingCard;
