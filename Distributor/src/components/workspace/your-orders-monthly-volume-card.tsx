"use client";

import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import type { YourOrdersMonthlyVolume } from "@/lib/your-orders-metrics";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";

const BAR_INACTIVE = "color-mix(in srgb, var(--chart-1) 24%, var(--muted))";
const BAR_ACTIVE = "var(--chart-1)";
const LABEL_INACTIVE = "var(--muted-foreground)";
const LABEL_ACTIVE = "var(--chart-1)";

type DistributorOrdersMonthlyVolumeCardProps = {
  volume: YourOrdersMonthlyVolume;
  className?: string;
};

function splitAmount(amount: number): { main: string; cents: string } {
  const fixed = amount.toFixed(2);
  const [whole, frac] = fixed.split(".");
  return { main: whole, cents: `.${frac}` };
}

export function DistributorOrdersMonthlyVolumeCard({
  volume,
  className,
}: DistributorOrdersMonthlyVolumeCardProps) {
  const amountParts = useMemo(
    () => splitAmount(volume.currentMonthAmount),
    [volume.currentMonthAmount],
  );

  const maxCount = useMemo(
    () => Math.max(...volume.bars.map((row) => row.count), 1),
    [volume.bars],
  );

  const chartData = useMemo(
    () =>
      volume.bars.map((row) => ({
        ...row,
        normalized: row.count / maxCount,
      })),
    [maxCount, volume.bars],
  );

  return (
    <article
      className={cn("distributor-orders-monthly-volume", className)}
      aria-label={`${volume.title ?? "Monthly orders"} ${formatAum(volume.currentMonthAmount)}`}
    >
      <p className="distributor-orders-monthly-volume__title">{volume.title ?? "Monthly orders"}</p>

      <p className="distributor-orders-monthly-volume__value tabular-nums">
        <span className="distributor-orders-monthly-volume__currency">₹</span>
        <span className="distributor-orders-monthly-volume__amount-main">{amountParts.main}</span>
        <span className="distributor-orders-monthly-volume__amount-cents">{amountParts.cents}</span>
      </p>

      <div className="distributor-orders-monthly-volume__chart" role="img">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            barCategoryGap="18%"
          >
            <YAxis hide domain={[0, 1]} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={({ x, y, payload }) => {
                const row = chartData.find((item) => item.month === payload.value);
                const isCurrent = row?.isCurrent ?? false;
                return (
                  <text
                    x={x}
                    y={Number(y) + 12}
                    textAnchor="middle"
                    className={cn(
                      "distributor-orders-monthly-volume__axis-tick",
                      isCurrent && "distributor-orders-monthly-volume__axis-tick--active",
                    )}
                    fill={isCurrent ? LABEL_ACTIVE : LABEL_INACTIVE}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <Bar dataKey="normalized" radius={[999, 999, 999, 999]} maxBarSize={28} isAnimationActive>
              {chartData.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={entry.isCurrent ? BAR_ACTIVE : BAR_INACTIVE}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
