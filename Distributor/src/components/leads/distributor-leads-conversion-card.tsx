"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import {
  getDistributorLeadConversionStats,
  type DistributorLeadRow,
} from "@/lib/dummy/distributor-leads";
import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import { DistributorGrowthBadge } from "@/components/ui/distributor-growth-badge";
import { cn } from "@/lib/utils";

const BAR_COUNT = 36;
const BAR_FILL_ACTIVE = "#3d6b5e";
const BAR_FILL_TRACK = "#e5e7eb";

type DistributorLeadsConversionCardProps = {
  rows: DistributorLeadRow[];
  className?: string;
};

type ConversionPeriod = {
  id: string;
  footLabel: string;
  invested: number;
  total: number;
  trendVsLastMonth: number;
};

function buildPeriods(
  invested: number,
  total: number,
  trendVsLastMonth: number,
): ConversionPeriod[] {
  const lastMonthInvested = Math.max(
    0,
    Math.min(total, Math.round(invested - total * (trendVsLastMonth / 100))),
  );
  const threeMonthsInvested = Math.max(0, Math.min(total, Math.round(invested - total * 0.08)));

  return [
    {
      id: "current",
      footLabel: "This month",
      invested,
      total,
      trendVsLastMonth,
    },
    {
      id: "last-month",
      footLabel: "Last month",
      invested: lastMonthInvested,
      total,
      trendVsLastMonth: Math.max(-9.9, trendVsLastMonth - 1.4),
    },
    {
      id: "three-months",
      footLabel: "3 months ago",
      invested: threeMonthsInvested,
      total,
      trendVsLastMonth: -0.8,
    },
  ];
}

function ConversionSegmentChart({ ratioPct }: { ratioPct: number }) {
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
      aria-label={`${ratioPct} percent of leads converted to first investment`}
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

export function DistributorLeadsConversionCard({
  rows,
  className,
}: DistributorLeadsConversionCardProps) {
  const stats = useMemo(() => getDistributorLeadConversionStats(rows), [rows]);
  const periods = useMemo(
    () => buildPeriods(stats.invested, stats.total, stats.trendVsLastMonth),
    [stats.invested, stats.total, stats.trendVsLastMonth],
  );
  const [periodIndex, setPeriodIndex] = useState(0);

  const period = periods[periodIndex] ?? periods[0];
  const ratioPct = period.total > 0 ? Math.round((period.invested / period.total) * 100) : 0;
  const trend = period.trendVsLastMonth;
  const inPipeline = stats.total - stats.invested;

  const goPrev = () => {
    setPeriodIndex((index) => (index <= 0 ? periods.length - 1 : index - 1));
  };

  const goNext = () => {
    setPeriodIndex((index) => (index >= periods.length - 1 ? 0 : index + 1));
  };

  return (
    <article
      className={cn("distributor-clients-investment-ratio", className)}
      aria-label={`Lead conversion ${ratioPct} percent`}
    >
      <div className="distributor-clients-investment-ratio__head">
        <DistributorInsightCardHeader
          eyebrow="Onboarding pipeline"
          title="Lead conversion"
          info="Share of leads in your pipeline who completed their first investment"
          className="distributor-clients-investment-ratio__header"
        />
        <p className="distributor-insight-card-summary-badge">
          <span className="tabular-nums">
            {period.invested} of {period.total}
          </span>
          <span aria-hidden> · </span>
          {period.footLabel}
          <span aria-hidden> · </span>
          <span className="tabular-nums">
            {inPipeline === 1 ? "1 in pipeline" : `${inPipeline} in pipeline`}
          </span>
        </p>
      </div>

      <div className="distributor-clients-investment-ratio__metric-row">
        <p className="distributor-clients-investment-ratio__value tabular-nums">{ratioPct}%</p>
        <DistributorGrowthBadge value={trend} suffix=" vs last month" />
      </div>

      <ConversionSegmentChart ratioPct={ratioPct} />

      <div className="distributor-clients-investment-ratio__foot">
        <div className="distributor-clients-investment-ratio__foot-leading">
          <span className="distributor-clients-investment-ratio__foot-label">Converted to invested</span>
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
        </div>
      </div>
    </article>
  );
}
