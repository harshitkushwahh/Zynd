"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DistributorInsightCardHeader } from "@/components/ui/distributor-insight-card-header";
import type { SupportOverviewTrendPoint } from "@/lib/support-overview-analytics-data";
import { cn } from "@/lib/utils";

type SupportOverviewTicketTrendsCardProps = {
  series: SupportOverviewTrendPoint[];
  className?: string;
};

export function SupportOverviewTicketTrendsCard({
  series,
  className,
}: SupportOverviewTicketTrendsCardProps) {
  const chartData = useMemo(() => [...series], [series]);

  return (
    <article
      className={cn(
        "distributor-operations-insight-card support-overview-insight-card support-overview-trends-card h-full min-h-[var(--distributor-dashboard-card-height,19.5rem)]",
        className,
      )}
    >
      <DistributorInsightCardHeader eyebrow="This week" title="Ticket trends" titleAs="p" />
      <div
        className="distributor-operations-insight-card__chart support-overview-trends-card__chart w-full min-h-0 flex-1"
        role="img"
        aria-label="Weekly ticket trends"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: -2 }}>
            <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tickMargin={4}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              interval={0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={28}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              contentStyle={{
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--border)",
                background: "var(--popover)",
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            />
            <Line
              type="monotone"
              dataKey="open"
              name="Open"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="inProgress"
              name="In progress"
              stroke="var(--chart-3)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="resolved"
              name="Resolved"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
