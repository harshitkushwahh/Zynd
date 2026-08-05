"use client";

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

import {
  ADMIN_FAMILY_GROUP_PROGRESS_PERIODS,
  type AdminFamilyGroupProgressChartPoint,
  type AdminFamilyGroupProgressPeriod,
} from "@/lib/admin-family-group-progress-chart-data";
import { AdminFamilyGroupChartEmptyState } from "@/components/users/admin-family-group-chart-empty-state";
import { formatCompactInr, formatInr } from "@/lib/format-inr";

type ProgressTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    value?: number | string;
    dataKey?: string;
    payload?: AdminFamilyGroupProgressChartPoint & {
      goalProgressInr: number;
      investedInr: number;
    };
  }>;
  label?: string | number;
};

function ProgressTooltip({ active, payload, label }: ProgressTooltipProps) {
  if (!active || !payload?.length) return null;

  const goal = payload.find((entry) => entry.dataKey === "goalProgressInr");
  const invested = payload.find((entry) => entry.dataKey === "investedInr");

  return (
    <div className="admin-family-group-recharts-tooltip">
      {label ? <p className="admin-family-group-recharts-tooltip__label">{label}</p> : null}
      {goal ? (
        <p className="admin-family-group-recharts-tooltip__row">
          <span>Goal progress</span>
          <span className="tabular-nums">{formatInr(Number(goal.value ?? 0))}</span>
        </p>
      ) : null}
      {invested ? (
        <p className="admin-family-group-recharts-tooltip__row">
          <span>MF invested</span>
          <span className="tabular-nums">{formatInr(Number(invested.value ?? 0))}</span>
        </p>
      ) : null}
    </div>
  );
}

function renderProgressTooltip(props: unknown) {
  return <ProgressTooltip {...(props as ProgressTooltipProps)} />;
}

type AdminFamilyGroupProgressAreaChartProps = {
  points: AdminFamilyGroupProgressChartPoint[];
  period: AdminFamilyGroupProgressPeriod;
  onPeriodChange: (period: AdminFamilyGroupProgressPeriod) => void;
  className?: string;
};

export function AdminFamilyGroupProgressAreaChart({
  points,
  period,
  onPeriodChange,
  className,
}: AdminFamilyGroupProgressAreaChartProps) {
  const goalGradientId = useId().replace(/:/g, "");
  const investedGradientId = `${goalGradientId}-invested`;

  const chartData = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        goalProgressInr: point.goalProgressInr,
        investedInr: point.investedInr,
      })),
    [points],
  );

  const latestGoal = points.at(-1)?.goalProgressInr ?? 0;
  const latestInvested = points.at(-1)?.investedInr ?? 0;

  return (
    <div className={className ? `admin-family-group-progress-chart ${className}` : "admin-family-group-progress-chart"}>
      <div className="admin-family-group-progress-chart__toolbar">
        <div className="admin-family-group-progress-chart__legend">
          <span className="admin-family-group-progress-chart__legend-item">
            <span className="admin-family-group-progress-chart__legend-dot admin-family-group-progress-chart__legend-dot--goal" />
            Goal progress
          </span>
          <span className="admin-family-group-progress-chart__legend-item">
            <span className="admin-family-group-progress-chart__legend-dot admin-family-group-progress-chart__legend-dot--invested" />
            MF invested
          </span>
        </div>
        <div
          className="admin-tab-list admin-tab-list--secondary admin-family-group-progress-chart__periods"
          role="tablist"
          aria-label="Chart period"
        >
          {ADMIN_FAMILY_GROUP_PROGRESS_PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={period === option}
              data-active={period === option ? "" : undefined}
              className="admin-tab-trigger admin-family-group-progress-chart__period-btn"
              onClick={() => onPeriodChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <AdminFamilyGroupChartEmptyState
          label="No progress history yet"
          description="Goal progress and MF investment trends will appear here once activity is recorded."
        />
      ) : (
        <>
          <div className="admin-family-group-progress-chart__summary">
            <span className="tabular-nums">Goal {formatCompactInr(latestGoal)}</span>
            <span className="text-muted-foreground">·</span>
            <span className="tabular-nums">Invested {formatCompactInr(latestInvested)}</span>
          </div>
          <div className="admin-family-group-progress-chart__plot">
            <ResponsiveContainer width="100%" height={240} minWidth={0}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={goalGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id={investedGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="color-mix(in srgb, var(--border) 70%, transparent)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(value) => formatCompactInr(Number(value))}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip content={renderProgressTooltip} />
                <Area
                  type="monotone"
                  dataKey="investedInr"
                  stroke="color-mix(in srgb, var(--muted-foreground) 75%, transparent)"
                  strokeWidth={2}
                  fill={`url(#${investedGradientId})`}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="goalProgressInr"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill={`url(#${goalGradientId})`}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

export type { AdminFamilyGroupProgressChartPoint };
