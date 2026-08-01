"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatCompactInr, formatInr } from "@/lib/format-inr";
import { AdminFamilyGroupChartEmptyState } from "@/components/users/admin-family-group-chart-empty-state";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#3d6b5e", "#5a9fd4", "#7ec8a8", "#d4a574", "#94a3b8", "#c084fc"];

export type AdminFamilyGroupDonutSegment = {
  id: string;
  label: string;
  value: number;
  fill?: string;
};

type DonutTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string;
    value?: number | string;
    payload?: AdminFamilyGroupDonutSegment;
  }>;
};

function DonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const value = Number(entry.value ?? 0);
  const label = entry.payload?.label ?? entry.name ?? "Segment";

  return (
    <div className="admin-family-group-recharts-tooltip">
      <p className="admin-family-group-recharts-tooltip__label">{label}</p>
      <p className="admin-family-group-recharts-tooltip__row">
        <span>Amount</span>
        <span className="tabular-nums">{formatInr(value)}</span>
      </p>
    </div>
  );
}

function renderDonutTooltip(props: unknown) {
  return <DonutTooltip {...(props as DonutTooltipProps)} />;
}

type AdminFamilyGroupDonutChartProps = {
  segments: AdminFamilyGroupDonutSegment[];
  centerValue: string;
  centerCaption: string;
  emptyLabel?: string;
  emptyDescription?: string;
  className?: string;
  onSegmentClick?: (id: string) => void;
  focusedId?: string | null;
};

export function AdminFamilyGroupDonutChart({
  segments,
  centerValue,
  centerCaption,
  emptyLabel = "Chart data",
  emptyDescription,
  className,
  onSegmentClick,
  focusedId = null,
}: AdminFamilyGroupDonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  const chartData = useMemo(
    () =>
      segments.map((segment, index) => ({
        ...segment,
        name: segment.label,
        fill: segment.fill ?? CHART_COLORS[index % CHART_COLORS.length],
      })),
    [segments],
  );

  if (total <= 0) {
    return (
      <AdminFamilyGroupChartEmptyState
        label={emptyLabel}
        description={emptyDescription}
        className={cn("admin-family-group-donut-chart--empty", className)}
      />
    );
  }

  return (
    <div className={cn("admin-family-group-donut-chart", className)}>
      <div className="admin-family-group-donut-chart__plot">
        <ResponsiveContainer width="100%" height={220} minWidth={0}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="68%"
              outerRadius="92%"
              paddingAngle={3}
              cornerRadius={6}
              stroke="var(--card)"
              strokeWidth={2}
              onClick={(entry) => {
                const id = (entry as AdminFamilyGroupDonutSegment).id;
                if (id && onSegmentClick) onSegmentClick(id);
              }}
            >
              {chartData.map((entry) => {
                const dimmed = focusedId !== null && focusedId !== entry.id;
                return (
                  <Cell
                    key={entry.id}
                    fill={entry.fill}
                    fillOpacity={dimmed ? 0.28 : 0.92}
                    stroke={focusedId === entry.id ? "var(--primary)" : undefined}
                    strokeWidth={focusedId === entry.id ? 2 : 0}
                    className={onSegmentClick ? "cursor-pointer" : undefined}
                  />
                );
              })}
            </Pie>
            <Tooltip content={renderDonutTooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="admin-family-group-donut-chart__center">
          <span className="admin-family-group-donut-chart__value tabular-nums">{centerValue}</span>
          <span className="admin-family-group-donut-chart__caption">{centerCaption}</span>
        </div>
      </div>
    </div>
  );
}

export function adminFamilyGroupDonutLegendColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}
