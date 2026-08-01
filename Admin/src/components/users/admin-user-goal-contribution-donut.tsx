"use client";

import { useMemo, type CSSProperties } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { AdminCircularProgressRing } from "@/components/ui/admin-circular-progress-ring";
import type { AdminGoalHoldingContribution } from "@/lib/admin-goal-holding-contributions";
import { formatInr } from "@/lib/format-inr";
import { cn } from "@/lib/utils";

type AdminUserGoalContributionDonutProps = {
  progressPct: number;
  contributions: AdminGoalHoldingContribution[];
  selectedId?: string | null;
  className?: string;
};

const OTHER_FUNDS_COLOR = "#cbd5e1";

function shortenFundLabel(label: string, maxLength = 14) {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1).trim()}…`;
}

type DonutTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string;
    value?: number | string;
    payload?: AdminGoalHoldingContribution & { fill?: string };
  }>;
};

function DonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const value = Number(entry.value ?? 0);
  const label = entry.payload?.label ?? entry.name ?? "Fund";
  const sharePct = entry.payload?.sharePct;
  const color = entry.payload?.fill ?? entry.payload?.color;

  return (
    <div
      className="admin-user-goal-donut-tooltip"
      style={color ? ({ "--admin-user-goal-donut-tooltip-color": color } as CSSProperties) : undefined}
    >
      <div className="admin-user-goal-donut-tooltip__head">
        <span className="admin-user-goal-donut-tooltip__dot" aria-hidden />
        <p className="admin-user-goal-donut-tooltip__label">{label}</p>
      </div>
      <div className="admin-user-goal-donut-tooltip__stats">
        <span className="admin-user-goal-donut-tooltip__stat tabular-nums">
          {sharePct != null ? `${sharePct}%` : "—"}
        </span>
        <span className="admin-user-goal-donut-tooltip__divider" aria-hidden />
        <span className="admin-user-goal-donut-tooltip__stat tabular-nums">{formatInr(value)}</span>
      </div>
    </div>
  );
}

function renderDonutTooltip(props: unknown) {
  return <DonutTooltip {...(props as DonutTooltipProps)} />;
}

export function AdminUserGoalContributionDonut({
  progressPct,
  contributions,
  selectedId = null,
  className,
}: AdminUserGoalContributionDonutProps) {
  const total = contributions.reduce((sum, item) => sum + item.amountInr, 0);
  const selectedContribution = selectedId
    ? contributions.find((contribution) => contribution.id === selectedId) ?? null
    : null;

  const chartData = useMemo(() => {
    if (!selectedContribution || total <= 0) {
      return contributions.map((contribution) => ({
        ...contribution,
        name: contribution.label,
        value: contribution.amountInr,
        fill: contribution.color,
      }));
    }

    const otherAmount = Math.max(0, total - selectedContribution.amountInr);

    return [
      {
        ...selectedContribution,
        name: selectedContribution.label,
        value: selectedContribution.amountInr,
        fill: selectedContribution.color,
      },
      {
        id: "other-funds",
        label: "Other funds",
        amc: "",
        amountInr: otherAmount,
        sharePct: Math.max(0, 100 - selectedContribution.sharePct),
        color: OTHER_FUNDS_COLOR,
        name: "Other funds",
        value: otherAmount,
        fill: OTHER_FUNDS_COLOR,
      },
    ];
  }, [contributions, selectedContribution, total]);

  if (total <= 0) {
    return (
      <AdminCircularProgressRing
        size="lg"
        progressPct={progressPct}
        primaryLabel={`${Math.round(progressPct)}%`}
        secondaryLabel="progress"
        ariaLabel={`${Math.round(progressPct)}% goal progress`}
        className={className}
      />
    );
  }

  return (
    <div className={cn("admin-user-goal-contribution-donut", className)}>
      <div className="admin-user-goal-contribution-donut__plot">
        <ResponsiveContainer width="100%" height={132} minWidth={0}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="68%"
              outerRadius="92%"
              paddingAngle={2}
              cornerRadius={5}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {chartData.map((entry) => {
                const isSelectedSlice =
                  selectedContribution != null &&
                  (entry.id === selectedContribution.id || entry.id === "other-funds");
                const isHighlighted =
                  selectedContribution == null || entry.id === selectedContribution.id;

                return (
                  <Cell
                    key={entry.id}
                    fill={entry.fill}
                    fillOpacity={isHighlighted ? 0.96 : 0.22}
                    stroke={isSelectedSlice && entry.id === selectedContribution.id ? entry.fill : "var(--card)"}
                    strokeWidth={isSelectedSlice && entry.id === selectedContribution.id ? 2.5 : 2}
                  />
                );
              })}
            </Pie>
            <Tooltip
              content={renderDonutTooltip}
              wrapperStyle={{
                outline: "none",
                zIndex: 20,
                padding: 0,
                background: "transparent",
                border: "none",
                boxShadow: "none",
              }}
              contentStyle={{
                padding: 0,
                background: "transparent",
                border: "none",
                boxShadow: "none",
              }}
              cursor={{ fill: "transparent" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="admin-user-goal-contribution-donut__center">
          {selectedContribution ? (
            <>
              <span
                className="admin-user-goal-contribution-donut__value tabular-nums"
                style={{ color: selectedContribution.color }}
              >
                {selectedContribution.sharePct}%
              </span>
              <span className="admin-user-goal-contribution-donut__caption truncate">
                {shortenFundLabel(selectedContribution.label)}
              </span>
            </>
          ) : (
            <>
              <span className="admin-user-goal-contribution-donut__value tabular-nums">
                {Math.round(progressPct)}%
              </span>
              <span className="admin-user-goal-contribution-donut__caption">progress</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
