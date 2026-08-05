"use client";

import Link from "next/link";
import { ArrowUpRight, Globe2, IndianRupee, Users } from "lucide-react";
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

import { DistributorGrowthBadge } from "@/components/ui/distributor-growth-badge";
import { getDistributorBookInsights } from "@/lib/distributor-book-insights";
import type { PortfolioChartPoint } from "@/lib/client-portfolio-chart-data";
import { YOUR_CLIENTS_LIST_HREF } from "@/lib/distributor-client-routes";
import { buildYourClientsListHref } from "@/lib/distributor-clients-list-scope";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

type BookInsightsTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string; payload?: PortfolioChartPoint }>;
  label?: string | number;
};

function BookInsightsTooltip({ active, payload, label }: BookInsightsTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-2.5 py-1.5 shadow-sm">
      {label ? <p className="text-micro text-muted-foreground">{label}</p> : null}
      <p className="text-caption font-semibold tabular-nums text-foreground">{formatAum(value)}</p>
    </div>
  );
}

function renderBookInsightsTooltip(props: unknown) {
  return <BookInsightsTooltip {...(props as BookInsightsTooltipProps)} />;
}

function chartDomain(points: PortfolioChartPoint[]): [number, number] {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values, 1);
  const pad = (max - min) * 0.12 || max * 0.08;
  return [Math.max(0, min - pad), max + pad];
}

function BookAumLineChart({ series }: { series: PortfolioChartPoint[] }) {
  const gradientId = useId().replace(/:/g, "");
  const domain = useMemo(() => chartDomain(series), [series]);
  const tickInterval = Math.max(0, Math.floor(series.length / 5) - 1);

  if (series.length === 0) {
    return (
      <p className="distributor-book-insights__chart-empty text-caption text-muted-foreground">
        No invested clients in your book yet.
      </p>
    );
  }

  return (
    <div
      className="distributor-book-insights__chart"
      role="img"
      aria-label="Book AUM trend over the last six months"
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
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
          <Tooltip content={renderBookInsightsTooltip} cursor={{ stroke: "var(--chart-1)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 2, fill: "var(--card)", stroke: "var(--chart-1)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributorBookInsightsCard({ className }: { className?: string }) {
  const insights = useMemo(() => getDistributorBookInsights(), []);

  return (
    <article className={cn("distributor-book-insights", className)}>
      <div className="distributor-book-insights__canvas">
        <Link href={YOUR_CLIENTS_LIST_HREF} className="distributor-book-insights__main">
          <div className="distributor-book-insights__metric-row">
            <span className="distributor-book-insights__metric-icon" aria-hidden>
              <IndianRupee className="size-4" strokeWidth={2.25} />
            </span>
            <div className="distributor-book-insights__metric-values">
              <div className="distributor-book-insights__metric-headline">
                <span className="distributor-book-insights__metric-value tabular-nums">
                  {formatAum(insights.bookAum)}
                </span>
                <DistributorGrowthBadge value={insights.aumChangePct} />
              </div>
              <p className="distributor-book-insights__metric-label">Total AUM · your book</p>
            </div>
          </div>

          <BookAumLineChart series={insights.aumSeries} />
        </Link>

        <div className="distributor-book-insights__side">
          <Link
            href={YOUR_CLIENTS_LIST_HREF}
            className="distributor-book-insights__side-card distributor-book-insights__side-card--primary"
          >
            <span className="distributor-book-insights__side-icon distributor-book-insights__side-icon--light">
              <Users className="size-3.5" strokeWidth={2.25} />
            </span>
            <div className="distributor-book-insights__side-metric">
              <div className="distributor-book-insights__side-headline">
                <span className="distributor-book-insights__side-value tabular-nums">
                  {insights.bookClientCount}
                </span>
                <span className="distributor-book-insights__side-trend">
                  {Math.round(insights.bookClientSharePct)}%
                  <ArrowUpRight className="size-3" strokeWidth={2.5} aria-hidden />
                </span>
              </div>
              <p className="distributor-book-insights__side-label">Your clients</p>
              <p className="distributor-book-insights__side-hint">
                {insights.onboardedCount} onboarded in book
              </p>
            </div>
          </Link>

          <Link
            href={buildYourClientsListHref("all")}
            className="distributor-book-insights__side-card distributor-book-insights__side-card--secondary"
          >
            <span className="distributor-book-insights__side-icon">
              <Globe2 className="size-3.5" strokeWidth={2.25} />
            </span>
            <div className="distributor-book-insights__side-metric">
              <div className="distributor-book-insights__side-headline">
                <span className="distributor-book-insights__side-value tabular-nums">
                  {insights.systemClientCount}
                </span>
                <span className="distributor-book-insights__side-trend distributor-book-insights__side-trend--muted">
                  {Math.round(insights.platformClientSharePct)}%
                  <ArrowUpRight className="size-3" strokeWidth={2.5} aria-hidden />
                </span>
              </div>
              <p className="distributor-book-insights__side-label">Total clients</p>
              <p className="distributor-book-insights__side-hint">Residents on platform (demo)</p>
            </div>
          </Link>
        </div>
      </div>
    </article>
  );
}
