"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DistributorChartTooltip } from "@/components/ui/distributor-chart-tooltip";
import { DUMMY_BRANCH_INVESTOR_FUNNEL } from "@/lib/dummy/branch-team-performance";

const CHART_HEIGHT = 260;

function funnelBarOpacity(index: number, total: number): number {
  return Math.max(0.35, 1 - (index / Math.max(total - 1, 1)) * 0.45);
}

type FunnelChartRow = {
  id: string;
  label: string;
  hint: string;
  count: number;
  convFromPrior: number | null;
};

type FunnelTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: FunnelChartRow; value?: number }>;
};

function FunnelTooltip({ active, payload }: FunnelTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <DistributorChartTooltip className="branch-perf-funnel-tooltip">
      <p className="text-caption font-semibold text-foreground">{row.label}</p>
      <p className="mt-0.5 text-micro text-muted-foreground">{row.hint}</p>
      <p className="mt-1.5 text-compact font-semibold tabular-nums text-foreground">
        {row.count.toLocaleString("en-IN")} investors
      </p>
      {row.convFromPrior !== null ? (
        <p className="mt-0.5 text-caption text-muted-foreground">{row.convFromPrior}% from prior stage</p>
      ) : null}
    </DistributorChartTooltip>
  );
}

function renderFunnelTooltip(props: unknown) {
  return <FunnelTooltip {...(props as FunnelTooltipProps)} />;
}

export function BranchInvestorFunnelChart() {
  const { chartData, domainMax } = useMemo(() => {
    const rows: FunnelChartRow[] = DUMMY_BRANCH_INVESTOR_FUNNEL.map((stage, index) => {
      const prev = DUMMY_BRANCH_INVESTOR_FUNNEL[index - 1];
      const convFromPrior =
        prev && prev.count > 0 ? Math.round((stage.count / prev.count) * 100) : null;
      return {
        id: stage.id,
        label: stage.label,
        hint: stage.hint,
        count: stage.count,
        convFromPrior,
      };
    });
    const max = rows[0]?.count ?? 1;
    return { chartData: rows, domainMax: max };
  }, []);

  return (
    <div
      className="branch-perf-chart branch-perf-funnel-chart h-[260px] w-full min-w-0 px-2 pb-4 pt-1"
      aria-label="Investor acquisition funnel"
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, domainMax]}
            hide
          />
          <YAxis
            type="category"
            dataKey="label"
            width={96}
            reversed
            tickLine={false}
            axisLine={false}
            tick={{
              fill: "var(--muted-foreground)",
              fontSize: 10,
              fontWeight: 500,
            }}
          />
          <Tooltip
            content={renderFunnelTooltip}
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
          />
          <Bar dataKey="count" name="Investors" radius={[0, 6, 6, 0]} maxBarSize={26}>
            {chartData.map((entry, index) => (
              <Cell key={entry.id} fill="var(--primary)" fillOpacity={funnelBarOpacity(index, chartData.length)} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              fill="var(--foreground)"
              fontSize={11}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
