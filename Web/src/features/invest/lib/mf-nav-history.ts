import type { InvestNavPoint } from "@/features/invest/api/invest-api";
import { formatDate, formatReturn } from "@/features/invest/lib/mf-format";

export type MfNavRange = "1m" | "3m" | "6m" | "1y" | "3y" | "5y" | "max";

export const MF_NAV_RANGE_OPTIONS: Array<{ id: MfNavRange; label: string; days: number | null }> = [
  { id: "1m", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 90 },
  { id: "6m", label: "6M", days: 180 },
  { id: "1y", label: "1Y", days: 365 },
  { id: "3y", label: "3Y", days: 365 * 3 },
  { id: "5y", label: "5Y", days: 365 * 5 },
  { id: "max", label: "Max", days: null },
];

export type MfNavChartPoint = {
  date: string;
  nav: number;
  label: string;
};

export function normalizeNavPoints(points: InvestNavPoint[]): MfNavChartPoint[] {
  return points
    .filter((point): point is InvestNavPoint & { nav: number } => point.nav != null)
    .map((point) => ({
      date: point.date,
      nav: point.nav,
      label: formatDate(point.date),
    }));
}

export function filterNavPointsByRange(points: MfNavChartPoint[], range: MfNavRange): MfNavChartPoint[] {
  if (points.length === 0) return [];
  if (range === "max") return points;

  const option = MF_NAV_RANGE_OPTIONS.find((item) => item.id === range);
  const days = option?.days;
  if (!days) return points;

  const end = new Date(points[points.length - 1].date);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const filtered = points.filter((point) => new Date(point.date) >= start);
  return filtered.length >= 2 ? filtered : points.slice(-Math.min(points.length, 2));
}

export function computeNavPeriodReturn(points: MfNavChartPoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].nav;
  const last = points[points.length - 1].nav;
  if (first <= 0) return null;
  return ((last / first) - 1) * 100;
}

export function formatNavPeriodReturn(points: MfNavChartPoint[]) {
  return formatReturn(computeNavPeriodReturn(points));
}

export function navRangeLabel(range: MfNavRange) {
  return MF_NAV_RANGE_OPTIONS.find((item) => item.id === range)?.label ?? range.toUpperCase();
}
