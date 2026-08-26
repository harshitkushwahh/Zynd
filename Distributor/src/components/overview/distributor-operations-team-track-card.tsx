"use client";

import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

const TOTAL_MEMBERS = 0;

const TEAM_SEGMENTS: ReadonlyArray<{ id: string; label: string; count: number; fill: string }> = [];

const GAUGE_CHART_HEIGHT = 124;
const GAUGE_OUTER_RADIUS = 88;
const GAUGE_INNER_RADIUS = 58;
/** Recharts pie center Y — arc sits on the bottom edge of the chart. */
const GAUGE_CENTER_Y = GAUGE_CHART_HEIGHT - 2;

const CHART_DATA = TEAM_SEGMENTS.map((segment) => ({
  name: segment.label,
  value: segment.count,
  fill: segment.fill,
}));

export function DistributorOperationsTeamTrackCard() {
  const chartData = useMemo(() => [...CHART_DATA], []);

  return (
    <article className="distributor-operations-team-card" aria-label="Track your team">
      <div className="distributor-operations-team-card__head">
        <DistributorInsightCardHeader
          eyebrow="Total employee"
          title="Track your team"
          titleAs="p"
        />
        <Link
          href="/dashboard/dist-management/distributors"
          className="distributor-operations-team-card__nav"
          aria-label="View team"
        >
          <ChevronRight className="size-4" strokeWidth={2.25} />
        </Link>
      </div>

      <div className="distributor-operations-team-card__gauge" role="img" aria-label="Team composition">
        <div className="distributor-operations-team-card__gauge-chart">
          <ResponsiveContainer width="100%" height={GAUGE_CHART_HEIGHT} minWidth={0}>
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy={GAUGE_CENTER_Y}
                startAngle={180}
                endAngle={0}
                innerRadius={GAUGE_INNER_RADIUS}
                outerRadius={GAUGE_OUTER_RADIUS}
                paddingAngle={3}
                cornerRadius={4}
                stroke="none"
                isAnimationActive
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="distributor-operations-team-card__gauge-center">
          <p className="distributor-operations-team-card__gauge-value tabular-nums">{TOTAL_MEMBERS}</p>
          <p className="distributor-operations-team-card__gauge-caption">Total members</p>
        </div>
      </div>

      <ul className="distributor-operations-team-card__legend">
        {TEAM_SEGMENTS.map((segment) => (
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
              {segment.count} members
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
