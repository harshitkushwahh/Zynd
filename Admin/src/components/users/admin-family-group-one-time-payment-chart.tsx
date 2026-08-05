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

import type { AdminFamilyGroupOneTimePayment } from "@/lib/family-groups-admin-api";
import { AdminFamilyGroupChartEmptyState } from "@/components/users/admin-family-group-chart-empty-state";
import { formatTimestampDetail } from "@/lib/format-date";
import { formatCompactInr, formatInr } from "@/lib/format-inr";
import { cn } from "@/lib/utils";

type OneTimeTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    value?: number | string;
    payload?: {
      label: string;
      detail: string;
      amount_inr: number;
      source_type: string;
    };
  }>;
};

function formatSourceType(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function OneTimeTooltip({ active, payload }: OneTimeTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <div className="admin-family-group-recharts-tooltip">
      <p className="admin-family-group-recharts-tooltip__label">{entry.label}</p>
      <p className="admin-family-group-recharts-tooltip__meta">{entry.detail}</p>
      <p className="admin-family-group-recharts-tooltip__row">
        <span>Amount</span>
        <span className="tabular-nums">{formatInr(entry.amount_inr)}</span>
      </p>
      <p className="admin-family-group-recharts-tooltip__row">
        <span>Source</span>
        <span>{formatSourceType(entry.source_type)}</span>
      </p>
    </div>
  );
}

function renderOneTimeTooltip(props: unknown) {
  return <OneTimeTooltip {...(props as OneTimeTooltipProps)} />;
}

type AdminFamilyGroupOneTimePaymentChartProps = {
  payments: AdminFamilyGroupOneTimePayment[];
  className?: string;
};

export function AdminFamilyGroupOneTimePaymentChart({
  payments,
  className,
}: AdminFamilyGroupOneTimePaymentChartProps) {
  const chartData = useMemo(
    () =>
      payments.map((payment) => ({
        id: payment.contribution_id,
        label: `${payment.member_label} · ${payment.goal_title}`,
        detail: [
          payment.member_display_name,
          payment.contributed_at ? formatTimestampDetail(payment.contributed_at) : null,
        ]
          .filter(Boolean)
          .join(" · "),
        amount_inr: payment.amount_inr,
        source_type: payment.source_type,
        is_lumpsum: payment.source_type === "lumpsum_order",
      })),
    [payments],
  );

  if (payments.length === 0) {
    return (
      <AdminFamilyGroupChartEmptyState
        label="No one-time payments yet"
        description="One-time payments toward family goals will appear here once submitted."
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
            width={128}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--foreground)", fontSize: 11 }}
          />
          <Tooltip
            content={renderOneTimeTooltip}
            cursor={{ fill: "color-mix(in srgb, var(--muted) 35%, transparent)" }}
          />
          <Bar dataKey="amount_inr" radius={[0, 6, 6, 0]} barSize={18}>
            {chartData.map((entry) => (
              <Cell
                key={entry.id}
                fill={
                  entry.is_lumpsum
                    ? "var(--primary)"
                    : "color-mix(in srgb, var(--chart-2) 85%, transparent)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
