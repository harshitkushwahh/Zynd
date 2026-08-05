"use client";

import { Info } from "lucide-react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DistributorGrowthBadge } from "@/components/ui/distributor-growth-badge";

const WORK_HOURS_SERIES = [
  { day: "Mon", hours: 6.5 },
  { day: "Tue", hours: 7.2 },
  { day: "Wed", hours: 8 },
  { day: "Thu", hours: 7.4 },
  { day: "Fri", hours: 9.1 },
  { day: "Sat", hours: 5.8 },
  { day: "Sun", hours: 4.2 },
] as const;

const AVERAGE_HOURS = 46;
const TREND_PCT = 0.5;

type WorkHoursTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number }>;
};

function WorkHoursTooltip({ active, payload }: WorkHoursTooltipProps) {
  if (!active || !payload?.length) return null;
  const hours = Number(payload[0]?.value ?? 0);
  return (
    <div className="distributor-operations-insight-card__tooltip">
      {hours % 1 === 0 ? `${hours} Hours` : `${hours.toFixed(1)} Hours`}
    </div>
  );
}

function renderWorkHoursTooltip(props: unknown) {
  return <WorkHoursTooltip {...(props as WorkHoursTooltipProps)} />;
}

export function DistributorOperationsWorkTimeCard() {
  const chartData = useMemo(() => [...WORK_HOURS_SERIES], []);

  return (
    <article className="distributor-operations-insight-card" aria-label="Average work time">
      <div className="distributor-operations-insight-card__head">
        <div className="distributor-operations-insight-card__title-block">
          <p className="distributor-operations-insight-card__eyebrow">Average work time</p>
          <p className="distributor-operations-insight-card__value tabular-nums">{AVERAGE_HOURS} hours</p>
        </div>
        <span aria-label={`Up ${TREND_PCT} percent`}>
          <DistributorGrowthBadge value={TREND_PCT} />
        </span>
      </div>

      <div className="distributor-operations-insight-card__chart" role="img" aria-label="Weekly hours trend">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" hide />
            <YAxis
              domain={[4, 10]}
              ticks={[4, 6, 8, 10]}
              axisLine={false}
              tickLine={false}
              width={34}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) => `${v} H`}
            />
            <Tooltip
              cursor={{ stroke: "var(--chart-1)", strokeWidth: 1 }}
              content={renderWorkHoursTooltip}
            />
            <Line
              type="monotone"
              dataKey="hours"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 0 }}
              activeDot={{
                r: 5,
                fill: "var(--card)",
                stroke: "var(--chart-1)",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="distributor-operations-insight-card__footnote">
        <Info className="size-3.5 shrink-0 opacity-70" strokeWidth={2.25} aria-hidden />
        <span>Total work hours include extra hours</span>
      </p>
    </article>
  );
}
