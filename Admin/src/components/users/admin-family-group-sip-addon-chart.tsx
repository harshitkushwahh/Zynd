"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AdminFamilyGroupSipAddon } from "@/lib/family-groups-admin-api";
import { AdminFamilyGroupChartEmptyState } from "@/components/users/admin-family-group-chart-empty-state";
import { formatCompactInr, formatInr } from "@/lib/format-inr";
import { cn } from "@/lib/utils";

type SipTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    value?: number | string;
    payload?: {
      label: string;
      detail: string;
      amount_inr: number;
      is_goal_linked: boolean;
    };
  }>;
};

function SipTooltip({ active, payload }: SipTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <div className="admin-family-group-recharts-tooltip">
      <p className="admin-family-group-recharts-tooltip__label">{entry.label}</p>
      <p className="admin-family-group-recharts-tooltip__meta">{entry.detail}</p>
      <p className="admin-family-group-recharts-tooltip__row">
        <span>Instalment</span>
        <span className="tabular-nums">{formatInr(entry.amount_inr)}</span>
      </p>
    </div>
  );
}

function renderSipTooltip(props: unknown) {
  return <SipTooltip {...(props as SipTooltipProps)} />;
}

function formatFrequency(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

type AdminFamilyGroupSipAddonChartProps = {
  addons: AdminFamilyGroupSipAddon[];
  className?: string;
};

export function AdminFamilyGroupSipAddonChart({
  addons,
  className,
}: AdminFamilyGroupSipAddonChartProps) {
  const chartData = useMemo(
    () =>
      addons.map((addon) => ({
        id: addon.plan_id,
        label: addon.member_label,
        detail: [
          addon.goal_title,
          formatFrequency(addon.frequency),
          addon.is_goal_linked ? "goal-linked" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        amount_inr: addon.amount_inr,
        is_goal_linked: addon.is_goal_linked,
      })),
    [addons],
  );

  if (addons.length === 0) {
    return (
      <AdminFamilyGroupChartEmptyState
        label="No SIP add-ons yet"
        description="Active SIP plans linked to this family group will appear here."
        className={className}
      />
    );
  }

  const chartHeight = Math.max(220, chartData.length * 52);

  return (
    <div className={cn("admin-family-group-sip-chart", className)}>
      <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
        >
          <CartesianGrid
            stroke="color-mix(in srgb, var(--border) 70%, transparent)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatCompactInr(Number(value))}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={96}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--foreground)", fontSize: 11 }}
          />
          <Tooltip content={renderSipTooltip} cursor={{ fill: "color-mix(in srgb, var(--muted) 35%, transparent)" }} />
          <Bar dataKey="amount_inr" radius={[0, 6, 6, 0]} barSize={18}>
            {chartData.map((entry) => (
              <Cell
                key={entry.id}
                fill={
                  entry.is_goal_linked
                    ? "var(--primary)"
                    : "color-mix(in srgb, var(--muted-foreground) 55%, transparent)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
