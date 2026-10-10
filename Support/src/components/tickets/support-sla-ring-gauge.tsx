"use client";

import { useMemo } from "react";
import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const RING_TRACK = "color-mix(in srgb, var(--border) 65%, var(--card))";

type SupportSlaRingGaugeProps = {
  title: string;
  centerPrimary: string;
  centerSecondary?: string;
  progressPct: number;
  ringFill?: string;
  targetLabel: string;
  statusVariant: StatusBadgeVariant;
  statusLabel: string;
  footnote?: string;
  className?: string;
};

export function SupportSlaRingGauge({
  title,
  centerPrimary,
  centerSecondary,
  progressPct,
  ringFill = "var(--chart-1)",
  targetLabel,
  statusVariant,
  statusLabel,
  footnote,
  className,
}: SupportSlaRingGaugeProps) {
  const chartData = useMemo(
    () => [{ name: "progress", value: Math.min(100, Math.max(0, progressPct)) }],
    [progressPct],
  );

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col items-center rounded-[var(--radius-card)] border border-border/70 bg-card px-4 py-4 text-center",
        className,
      )}
    >
      <p className="text-caption font-medium text-muted-foreground">{title}</p>
      <div className="relative mt-3 size-[6.5rem]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="76%"
            outerRadius="100%"
            barSize={7}
            data={chartData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              background={{ fill: RING_TRACK }}
              dataKey="value"
              cornerRadius={999}
              fill={ringFill}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-[22%] flex flex-col items-center justify-center">
          <p className="font-heading text-body font-bold leading-none tabular-nums text-foreground">
            {centerPrimary}
          </p>
          {centerSecondary ? (
            <p className="mt-0.5 text-[10px] font-medium leading-none text-muted-foreground">
              {centerSecondary}
            </p>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-caption text-muted-foreground">{targetLabel}</p>
      <StatusBadge variant={statusVariant} className="mt-2">
        {statusLabel}
      </StatusBadge>
      {footnote ? <p className="mt-1.5 text-micro text-muted-foreground">{footnote}</p> : null}
    </article>
  );
}
