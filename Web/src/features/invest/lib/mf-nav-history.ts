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

export function navHistorySpanDays(points: MfNavChartPoint[]): number | null {
  if (points.length < 2) return null;
  const first = new Date(points[0].date);
  const last = new Date(points[points.length - 1].date);
  return Math.floor((last.getTime() - first.getTime()) / 86_400_000);
}

export function hasSufficientNavHistoryForRange(
  allPoints: MfNavChartPoint[],
  range: MfNavRange,
): boolean {
  if (allPoints.length < 2) return false;
  if (range === "max") return true;

  const days = MF_NAV_RANGE_OPTIONS.find((item) => item.id === range)?.days;
  if (days == null) return true;

  const span = navHistorySpanDays(allPoints);
  return span != null && span >= days;
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
  if (filtered.length >= 2) return filtered;

  return points.length >= 2 ? points : filtered;
}

export function computeNavPeriodReturn(
  points: MfNavChartPoint[],
  options?: { range?: MfNavRange; allPoints?: MfNavChartPoint[] },
): number | null {
  if (points.length < 2) return null;

  const range = options?.range;
  const allPoints = options?.allPoints ?? points;
  if (range && !hasSufficientNavHistoryForRange(allPoints, range)) {
    return null;
  }

  const first = points[0].nav;
  const last = points[points.length - 1].nav;
  if (first <= 0) return null;
  return ((last / first) - 1) * 100;
}

export function formatNavPeriodReturn(
  points: MfNavChartPoint[],
  options?: { range?: MfNavRange; allPoints?: MfNavChartPoint[] },
) {
  return formatReturn(computeNavPeriodReturn(points, options));
}

export function navRangeLabel(range: MfNavRange) {
  return MF_NAV_RANGE_OPTIONS.find((item) => item.id === range)?.label ?? range.toUpperCase();
}
