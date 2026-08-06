"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { OverviewAllocationSlice } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import { portfolioAllocationChartFill } from "@/features/dashboard/portfolio/lib/portfolio-allocation-colors";

export type PortfolioAllocationChartSlice = OverviewAllocationSlice & {
  fill: string;
};

type PortfolioAllocationDonutChartProps = {
  slices: PortfolioAllocationChartSlice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type AllocationDonutTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: PortfolioAllocationChartSlice }>;
};

function AllocationDonutTooltip({ active, payload }: AllocationDonutTooltipProps) {
  if (!active || !payload?.length) return null;

  const slice = payload[0]?.payload;
  if (!slice) return null;

  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-zynd-mid">
      <p className="text-caption text-muted-foreground">{slice.label}</p>
      <p className="text-compact font-semibold tabular-nums text-foreground">{slice.valuePct}%</p>
    </div>
  );
}

function renderAllocationDonutTooltip(props: unknown) {
  return <AllocationDonutTooltip {...(props as AllocationDonutTooltipProps)} />;
}

export function PortfolioAllocationDonutChart({
  slices,
  selectedId,
  onSelect,
}: PortfolioAllocationDonutChartProps) {
  const activeIndex = selectedId ? slices.findIndex((slice) => slice.id === selectedId) : -1;
  const hasSelection = selectedId !== null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          content={renderAllocationDonutTooltip}
          wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
        />
        <Pie
          data={slices}
          dataKey="valuePct"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius="68%"
          outerRadius="100%"
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
          activeIndex={activeIndex >= 0 ? activeIndex : undefined}
          onClick={(_, index) => {
            const slice = slices[index];
            if (slice) onSelect(slice.id);
          }}
        >
          {slices.map((slice) => (
            <Cell
              key={slice.id}
              fill={slice.fill}
              fillOpacity={!hasSelection || selectedId === slice.id ? 1 : 0.38}
              className="cursor-pointer outline-none transition-[fill-opacity] duration-200"
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function mapPortfolioAllocationChartSlices(
  slices: readonly OverviewAllocationSlice[],
): PortfolioAllocationChartSlice[] {
  return slices.map((slice) => ({
    ...slice,
    fill: portfolioAllocationChartFill(slice),
  }));
}
