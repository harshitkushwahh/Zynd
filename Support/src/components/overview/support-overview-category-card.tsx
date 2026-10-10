"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import type { SupportOverviewCategorySegment } from "@/lib/support-overview-analytics-data";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 148;
const OUTER_RADIUS = 72;
const INNER_RADIUS = 48;

type SupportOverviewCategoryCardProps = {
  segments: SupportOverviewCategorySegment[];
  className?: string;
};

export function SupportOverviewCategoryCard({
  segments,
  className,
}: SupportOverviewCategoryCardProps) {
  const chartData = useMemo(
    () => segments.map((segment) => ({ name: segment.label, value: segment.count, fill: segment.fill })),
    [segments],
  );
  const total = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.count, 0),
    [segments],
  );

  return (
    <article
      className={cn(
        "distributor-operations-team-card support-overview-insight-card support-overview-category-card h-full min-h-[var(--distributor-dashboard-card-height,19.5rem)]",
        className,
      )}
    >
      <div className="distributor-operations-team-card__head">
        <DistributorInsightCardHeader
          eyebrow="Volume mix"
          title="Tickets by category"
          titleAs="p"
        />
        <Link
          href="/dashboard/tickets"
          className="distributor-operations-team-card__nav"
          aria-label="View tickets"
        >
          <ChevronRight className="size-4" strokeWidth={2.25} />
        </Link>
      </div>

      <div className="distributor-operations-team-card__gauge" role="img" aria-label="Ticket category distribution">
        <div className="distributor-operations-team-card__gauge-chart">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={INNER_RADIUS}
                outerRadius={OUTER_RADIUS}
                paddingAngle={2}
                stroke="none"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="distributor-operations-team-card__gauge-center">
          <p className="distributor-operations-team-card__gauge-value tabular-nums">{total}</p>
          <p className="distributor-operations-team-card__gauge-caption">Total tickets</p>
        </div>
      </div>

      <ul className="distributor-operations-team-card__legend support-overview-category-card__legend">
        {segments.map((segment) => (
          <li key={segment.id} className="distributor-operations-team-card__legend-row">
            <span className="distributor-operations-team-card__legend-label">
              <span
                className="distributor-operations-team-card__legend-dot"
                style={{ backgroundColor: segment.fill }}
                aria-hidden
              />
              {segment.label}
            </span>
            <span className="distributor-operations-team-card__legend-count tabular-nums">
              {segment.count}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
