export type OverviewPortfolioFlowRange = "1m" | "3m" | "6m" | "1y" | "3y" | "5y" | "10y" | "all";

export type OverviewPortfolioFlowPoint = {
  date: string;
  label: string;
  invested: number;
  value: number;
};

export const OVERVIEW_PORTFOLIO_FLOW_RANGE_OPTIONS: Array<{
  id: OverviewPortfolioFlowRange;
  label: string;
  days: number | null;
}> = [
  { id: "1m", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 90 },
  { id: "6m", label: "6M", days: 180 },
  { id: "1y", label: "1Y", days: 365 },
  { id: "3y", label: "3Y", days: 365 * 3 },
  { id: "5y", label: "5Y", days: 365 * 5 },
  { id: "10y", label: "10Y", days: 365 * 10 },
  { id: "all", label: "All", days: null },
];

export function filterPortfolioFlowByRange(
  points: readonly OverviewPortfolioFlowPoint[],
  range: OverviewPortfolioFlowRange,
): OverviewPortfolioFlowPoint[] {
  if (points.length === 0) return [];

  const option = OVERVIEW_PORTFOLIO_FLOW_RANGE_OPTIONS.find((item) => item.id === range);
  if (!option || option.days == null) return [...points];

  const end = new Date(points[points.length - 1].date);
  const start = new Date(end);
  start.setDate(start.getDate() - option.days);

  const filtered = points.filter((point) => new Date(point.date) >= start);
  if (filtered.length >= 2) return [...filtered];

  return points.slice(Math.max(0, points.length - 2));
}

export function portfolioFlowYDomain(points: OverviewPortfolioFlowPoint[]): [number, number] {
  if (points.length === 0) return [0, 1];

  const values = points.flatMap((point) => [point.invested, point.value]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return [min - range * 0.04, max + range * 0.08];
}
