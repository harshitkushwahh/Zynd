"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useId, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { DistributorGrowthBadge } from "@/components/ui/distributor-growth-badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function sparklineDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.2, max * 0.08, 1);
  return [Math.max(0, min - pad), max + pad];
}

type SupportOverviewMetricTileProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  trendPct: number;
  sparkline: number[];
  href?: string;
  tileTone?: "default" | "accent" | "success";
  showTileIcon?: boolean;
  showTileAction?: boolean;
};

export function SupportOverviewMetricTile({
  icon: Icon,
  label,
  value,
  trendPct,
  sparkline,
  href,
  tileTone = "default",
  showTileIcon = true,
  showTileAction = true,
}: SupportOverviewMetricTileProps) {
  const isAccent = tileTone === "accent";
  const isSuccess = tileTone === "success";
  const gradientId = useId().replace(/:/g, "");

  const chartData = useMemo(
    () => sparkline.map((point, index) => ({ index, value: point })),
    [sparkline],
  );

  const yDomain = useMemo(() => sparklineDomain(sparkline), [sparkline]);

  const chartStroke = isAccent
    ? "color-mix(in srgb, var(--primary-foreground) 94%, transparent)"
    : "var(--chart-1)";
  const chartFillTop = isAccent ? "var(--primary-foreground)" : "var(--chart-1)";

  const showTileHeader = showTileIcon || (showTileAction && href);

  const cardClass = cn(
    "support-overview-metric-tile distributor-metric-card--tile h-full w-full overflow-hidden rounded-[var(--radius-5xl)] ring-0",
    isAccent && "support-overview-metric-tile--accent distributor-metric-card--tile-accent",
    isSuccess && "support-overview-metric-tile--success distributor-metric-card--tile-success",
  );

  const body = (
    <Card className={cardClass}>
      <CardContent className="distributor-metric-card__body distributor-metric-card__body--tile">
        {showTileHeader ? (
          <div className="distributor-metric-card__tile-header">
            {showTileIcon ? (
              <span
                className={cn(
                  "distributor-metric-card__tile-icon",
                  isAccent && "distributor-metric-card__tile-icon--accent",
                  isSuccess && "distributor-metric-card__tile-icon--success",
                )}
                aria-hidden
              >
                <Icon strokeWidth={2.25} />
              </span>
            ) : (
              <span aria-hidden />
            )}
            {showTileAction && href ? (
              <span
                className={cn(
                  "distributor-metric-card__tile-action",
                  isAccent && "distributor-metric-card__tile-action--accent",
                  isSuccess && "distributor-metric-card__tile-action--success",
                )}
                aria-hidden
              >
                <ArrowUpRight strokeWidth={2.25} />
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="distributor-metric-card__tile-main">
          <span className="distributor-metric-card__value distributor-metric-card__value--tile tabular-nums">
            {value}
          </span>
          <span className="distributor-metric-card__tile-label">{label}</span>
          <DistributorGrowthBadge value={trendPct} suffix=" vs last week" className="mt-1" />
        </div>
        <div className="support-overview-metric-tile__sparkline" aria-hidden>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={chartFillTop}
                    stopOpacity={isAccent ? 0.42 : 0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor={chartFillTop}
                    stopOpacity={isAccent ? 0.06 : 0.02}
                  />
                </linearGradient>
              </defs>
              <YAxis domain={yDomain} hide />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartStroke}
                fill={`url(#${gradientId})`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return body;

  return (
    <Link
      href={href}
      className="distributor-metric-card__link block h-full min-h-0 min-w-0 w-full cursor-pointer no-underline focus-visible:outline-none"
    >
      {body}
    </Link>
  );
}
