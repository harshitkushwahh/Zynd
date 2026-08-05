"use client";

import { useEffect, useMemo } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import type { InvestFundDetail } from "@/features/invest/api/invest-api";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfNavRangeTabs } from "@/features/invest/components/mf-nav-range-tabs";
import {
  buildCompareNavChartRows,
  COMPARE_FUND_CHART_COLORS,
  type CompareFundNavSeries,
} from "@/features/invest/lib/mf-compare-nav-series";
import { formatChartAxisDate } from "@/features/invest/lib/mf-format";
import {
  hasSufficientNavHistoryForCompareRange,
  resolveNavRangeForCompareHistory,
  type MfNavRange,
} from "@/features/invest/lib/mf-nav-history";
import { MF_CALC_ICON_BADGE_CLASS, MF_CALC_PANEL_CLASS } from "@/features/invest/lib/mf-calculator-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 300;

type CompareChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string; value?: number; color?: string }>;
  label?: string;
  funds: InvestFundDetail[];
};

function CompareChartTooltip({ active, payload, label, funds }: CompareChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="max-w-xs rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-zynd-mid">
      <p className="mb-1.5 text-caption text-muted-foreground">{label}</p>
      <ul className="space-y-1.5">
        {payload.map((entry) => {
          if (entry.dataKey == null || entry.value == null) return null;
          const fund = funds.find((item) => item.product_id === entry.dataKey);
          if (!fund) return null;

          return (
            <li key={fund.product_id} className="flex items-center gap-2">
              <MfFundAmcAvatar
                amcLogoUrl={fund.amc_logo_url}
                amcName={fund.amc_name}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-foreground">{fund.name}</p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {Number(entry.value).toFixed(1)}
                </p>
              </div>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CompareChartLegend({ funds }: { funds: InvestFundDetail[] }) {
  return (
    <ul
      className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label={copy.mutualFunds.compareChartTitle}
    >
      {funds.map((fund, index) => (
        <li key={fund.product_id} className="flex min-w-0 items-start gap-2.5">
          <MfFundAmcAvatar amcLogoUrl={fund.amc_logo_url} amcName={fund.amc_name} size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COMPARE_FUND_CHART_COLORS[index % COMPARE_FUND_CHART_COLORS.length] }}
                aria-hidden
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                {copy.mutualFunds.compareSelectFund.replace("{slot}", String(index + 1))}
              </span>
            </div>
            <p className="text-caption leading-snug text-foreground">{fund.name}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

type MfCompareFundsNavChartProps = {
  funds: InvestFundDetail[];
  series: CompareFundNavSeries[];
  range: MfNavRange;
  onRangeChange: (range: MfNavRange) => void;
  loading?: boolean;
  showHeader?: boolean;
};

export function MfCompareFundsNavChart({
  funds,
  series,
  range,
  onRangeChange,
  loading = false,
}: MfCompareFundsNavChartProps) {
  const effectiveRange = useMemo(
    () => resolveNavRangeForCompareHistory(series, range),
    [series, range],
  );

  useEffect(() => {
    if (effectiveRange !== range) {
      onRangeChange(effectiveRange);
    }
  }, [effectiveRange, onRangeChange, range]);

  const chartRows = useMemo(
    () => buildCompareNavChartRows(series, effectiveRange),
    [series, effectiveRange],
  );

  const tickInterval = Math.max(1, Math.floor(chartRows.length / 5));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MfNavRangeTabs
          value={effectiveRange}
          onChange={onRangeChange}
          isRangeAvailable={(nextRange) => hasSufficientNavHistoryForCompareRange(series, nextRange)}
          ariaLabel={copy.mutualFunds.compareChartTitle}
        />
        <p className="text-caption text-muted-foreground">{copy.mutualFunds.compareChartIndexedHint}</p>
      </div>

      {loading ? (
        <Skeleton className="h-[300px] w-full rounded-[var(--radius-card)]" aria-busy="true" />
      ) : chartRows.length < 2 ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-muted/10 px-6 text-center">
          <p className="text-compact text-muted-foreground">{copy.mutualFunds.compareChartEmpty}</p>
        </div>
      ) : (
        <div className={cn(MF_CALC_PANEL_CLASS, "space-y-4 p-3 pt-4 sm:p-4 sm:pt-5")}>
          <div className="w-full min-w-0 pb-1 [&_.recharts-cartesian-grid]:overflow-visible [&_.recharts-surface]:overflow-visible">
            <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
              <LineChart data={chartRows} margin={{ top: 12, right: 12, left: 4, bottom: 28 }}>
                <CartesianGrid
                  stroke="color-mix(in srgb, var(--border) 80%, transparent)"
                  strokeDasharray="3 6"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                  interval={tickInterval}
                  tickFormatter={(value) => formatChartAxisDate(String(value))}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  dy={8}
                  height={36}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(value) => String(Math.round(Number(value)))}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip
                  content={(props) => (
                    <CompareChartTooltip
                      {...(props as unknown as CompareChartTooltipProps)}
                      funds={funds}
                    />
                  )}
                />
                {funds.map((fund, index) => (
                  <Line
                    key={fund.product_id}
                    type="monotone"
                    dataKey={fund.product_id}
                    stroke={COMPARE_FUND_CHART_COLORS[index % COMPARE_FUND_CHART_COLORS.length]}
                    strokeWidth={2.25}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }}
                    connectNulls
                    isAnimationActive
                    legendType="none"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <CompareChartLegend funds={funds} />
        </div>
      )}

    </div>
  );
}

export function MfCompareFundsNavChartSection({
  funds,
  series,
  range,
  onRangeChange,
  loading,
  showHeader = true,
}: MfCompareFundsNavChartProps) {
  if (funds.length === 0) return null;

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div className="flex items-center gap-2.5">
          <span className={MF_CALC_ICON_BADGE_CLASS}>
            <LineChartIcon className="size-4" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-body font-semibold tracking-tight text-foreground">
              {copy.mutualFunds.compareChartTitle}
            </p>
            <p className="text-caption text-muted-foreground">{copy.mutualFunds.compareChartDescription}</p>
          </div>
        </div>
      ) : null}
      <MfCompareFundsNavChart
        funds={funds}
        series={series}
        range={range}
        onRangeChange={onRangeChange}
        loading={loading}
      />
    </div>
  );
}
