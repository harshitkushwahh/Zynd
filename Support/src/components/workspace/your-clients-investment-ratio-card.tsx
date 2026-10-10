"use client";

import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import { cn } from "@/lib/utils";

const BAR_COUNT = 36;
const BAR_FILL_ACTIVE = "#f97316";
const BAR_FILL_TRACK = "#e5e7eb";

export type YourClientsInvestmentRatioStats = {
  total: number;
  invested: number;
  /** Demo week-over-week change in percentage points */
  trendVsLastWeek?: number;
};

type DistributorClientsInvestmentRatioCardProps = {
  stats: YourClientsInvestmentRatioStats;
  className?: string;
};

type RatioPeriod = {
  id: string;
  footLabel: string;
  invested: number;
  total: number;
  trendVsLastWeek: number;
};

function buildPeriods(stats: YourClientsInvestmentRatioStats): RatioPeriod[] {
  const trend = stats.trendVsLastWeek ?? 2.1;
  const { invested, total } = stats;
  const lastWeekInvested = Math.max(0, Math.min(total, Math.round(invested - total * (trend / 100))));
  const fourWeeksInvested = Math.max(0, Math.min(total, Math.round(invested - total * 0.05)));

  return [
    {
      id: "current",
      footLabel: "This week",
      invested,
      total,
      trendVsLastWeek: trend,
    },
    {
      id: "last-week",
      footLabel: "Last week",
      invested: lastWeekInvested,
      total,
      trendVsLastWeek: Math.max(-9.9, trend - 1.2),
    },
    {
      id: "four-weeks",
      footLabel: "4 weeks ago",
      invested: fourWeeksInvested,
      total,
      trendVsLastWeek: -0.6,
    },
  ];
}

function InvestmentRatioSegmentChart({ ratioPct }: { ratioPct: number }) {
  const filledBars = Math.round((ratioPct / 100) * BAR_COUNT);

  const chartData = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, index) => ({
        index,
        value: 1,
        filled: index < filledBars,
      })),
    [filledBars],
  );

  return (
    <div
      className="distributor-clients-investment-ratio__chart"
      role="img"
      aria-label={`${ratioPct} percent of clients are invested`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={chartData}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          barCategoryGap={2}
          barGap={0}
        >
          <XAxis dataKey="index" hide />
          <YAxis hide domain={[0, 1]} />
          <Bar dataKey="value" isAnimationActive animationDuration={450} radius={[2, 2, 2, 2]}>
            {chartData.map((entry) => (
              <Cell key={entry.index} fill={entry.filled ? BAR_FILL_ACTIVE : BAR_FILL_TRACK} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributorClientsInvestmentRatioCard({
  stats,
  className,
}: DistributorClientsInvestmentRatioCardProps) {
  const periods = useMemo(() => buildPeriods(stats), [stats]);
  const [periodIndex, setPeriodIndex] = useState(0);

  const period = periods[periodIndex] ?? periods[0];
  const ratioPct =
    period.total > 0 ? Math.round((period.invested / period.total) * 100) : 0;
  const trend = period.trendVsLastWeek;

  const goPrev = () => {
    setPeriodIndex((i) => (i <= 0 ? periods.length - 1 : i - 1));
  };

  const goNext = () => {
    setPeriodIndex((i) => (i >= periods.length - 1 ? 0 : i + 1));
  };

  return (
    <article
      className={cn("distributor-clients-investment-ratio", className)}
      aria-label={`Investment ratio ${ratioPct} percent`}
    >
      <div className="distributor-clients-investment-ratio__head">
        <DistributorInsightCardHeader
          eyebrow="Client book"
          title="Investment ratio"
          className="distributor-clients-investment-ratio__header"
        />
        <div className="distributor-clients-investment-ratio__head-trailing">
          <p className="distributor-insight-card-summary-badge">
            <span className="tabular-nums">
              {period.invested} of {period.total}
            </span>
            <span aria-hidden> · </span>
            {period.footLabel}
            <span aria-hidden> · </span>
            <span className="tabular-nums">
              {trend >= 0 ? "+" : ""}
              {trend.toFixed(1)}%
            </span>
          </p>
          <div className="distributor-clients-investment-ratio__head-trailing-controls">
            <div className="distributor-clients-investment-ratio__pager">
              <button
                type="button"
                className="distributor-clients-investment-ratio__pager-btn"
                aria-label="Previous period"
                onClick={goPrev}
              >
                <ChevronLeft className="size-3.5" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                className="distributor-clients-investment-ratio__pager-btn"
                aria-label="Next period"
                onClick={goNext}
              >
                <ChevronRight className="size-3.5" strokeWidth={2.25} />
              </button>
            </div>
            <button
              type="button"
              className="distributor-insight-card-header__info distributor-clients-investment-ratio__info"
              title="Share of your book clients with an active investment"
              aria-label="Share of your book clients with an active investment"
            >
              <Info className="size-3.5" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div className="distributor-clients-investment-ratio__metric-row">
        <p className="distributor-clients-investment-ratio__value tabular-nums">{ratioPct}%</p>
      </div>

      <InvestmentRatioSegmentChart ratioPct={ratioPct} />
    </article>
  );
}
