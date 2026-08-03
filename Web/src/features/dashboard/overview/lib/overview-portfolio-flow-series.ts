/** Preview-only portfolio flow series until live portfolio sync is available. */

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

const END_VALUE = 4_28_650;
const END_INVESTED = 3_81_400;

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function buildPreviewPortfolioFlowSeries(): OverviewPortfolioFlowPoint[] {
  const points: OverviewPortfolioFlowPoint[] = [];
  const endDate = new Date();
  endDate.setHours(12, 0, 0, 0);
  const totalMonths = 120;

  for (let index = 0; index <= totalMonths; index += 1) {
    const date = new Date(endDate);
    date.setMonth(date.getMonth() - (totalMonths - index));

    const progress = index / totalMonths;
    const invested = Math.round(END_INVESTED * (0.22 + 0.78 * progress ** 1.05));
    const gainFactor = 1 + 0.124 * progress ** 1.15 + Math.sin(index / 4.5) * 0.012;
    const value = Math.round(Math.max(invested, invested * gainFactor));

    points.push({
      date: date.toISOString().slice(0, 10),
      label: monthLabel(date),
      invested,
      value: index === totalMonths ? END_VALUE : value,
    });
  }

  points[points.length - 1] = {
    ...points[points.length - 1],
    invested: END_INVESTED,
    value: END_VALUE,
  };

  return points;
}

export const OVERVIEW_PORTFOLIO_FLOW_SERIES = buildPreviewPortfolioFlowSeries();

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
  const values = points.flatMap((point) => [point.invested, point.value]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return [min - range * 0.04, max + range * 0.08];
}
