import type { InvestFundDetail, InvestNavPoint } from "@/features/invest/api/invest-api";
import {
  filterNavPointsByRange,
  normalizeNavPoints,
  type MfNavRange,
} from "@/features/invest/lib/mf-nav-history";
import { formatDate } from "@/features/invest/lib/mf-format";

export type CompareFundNavSeries = {
  fund: InvestFundDetail;
  navPoints: InvestNavPoint[];
};

export type CompareNavChartRow = {
  date: string;
  label: string;
  [productId: string]: string | number;
};

export const COMPARE_FUND_CHART_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--chart-3, var(--warning))",
] as const;

export function buildCompareNavChartRows(
  series: CompareFundNavSeries[],
  range: MfNavRange,
): CompareNavChartRow[] {
  if (series.length === 0) return [];

  const indexedByFund = series.map(({ fund, navPoints }) => {
    const ranged = filterNavPointsByRange(normalizeNavPoints(navPoints), range);
    const firstNav = ranged[0]?.nav;
    const byDate = new Map<string, number>();
    if (firstNav && firstNav > 0) {
      for (const point of ranged) {
        byDate.set(point.date, (point.nav / firstNav) * 100);
      }
    }
    return { productId: fund.product_id, byDate };
  });

  const dates = [
    ...new Set(indexedByFund.flatMap((entry) => [...entry.byDate.keys()])),
  ].sort();

  return dates
    .map((date) => {
      const row: CompareNavChartRow = { date, label: formatDate(date) };
      for (const entry of indexedByFund) {
        const value = entry.byDate.get(date);
        if (value != null) {
          row[entry.productId] = value;
        }
      }
      return row;
    })
    .filter((row) => indexedByFund.some((entry) => row[entry.productId] != null));
}
