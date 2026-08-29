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

const PORTFOLIO_FLOW_ONE_MONTH_DAYS = 30;

export function portfolioFlowInvestingStartDate(
  points: readonly OverviewPortfolioFlowPoint[],
): Date | null {
  const firstInvested = points.find((point) => point.invested > 0);
  if (!firstInvested) {
    return points[0] ? new Date(points[0].date) : null;
  }
  return new Date(firstInvested.date);
}

/** Calendar days from first investment point to the latest series point. */
export function portfolioFlowHistoryDays(points: readonly OverviewPortfolioFlowPoint[]): number {
  const investedPoints = points.filter((point) => point.invested > 0);
  if (investedPoints.length === 0) return 0;
  if (investedPoints.length === 1) return 0;

  const start = new Date(investedPoints[0].date);
  const end = new Date(points[points.length - 1].date);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

export function isPortfolioFlowRangeEnabled(
  range: OverviewPortfolioFlowRange,
  historyDays: number,
  hasData = true,
): boolean {
  if (!hasData) return false;
  if (range === "1m" || range === "all") return true;
  if (historyDays < PORTFOLIO_FLOW_ONE_MONTH_DAYS) return false;

  const option = OVERVIEW_PORTFOLIO_FLOW_RANGE_OPTIONS.find((item) => item.id === range);
  if (!option) return false;
  if (option.days == null) return true;
  return historyDays >= option.days;
}

export function resolveEnabledPortfolioFlowRanges(
  series: readonly OverviewPortfolioFlowPoint[],
): OverviewPortfolioFlowRange[] {
  const historyDays = portfolioFlowHistoryDays(series);
  const hasData = series.length > 0;

  return OVERVIEW_PORTFOLIO_FLOW_RANGE_OPTIONS.filter((option) =>
    isPortfolioFlowRangeEnabled(option.id, historyDays, hasData),
  ).map((option) => option.id);
}

export function resolveDefaultPortfolioFlowRange(
  series: readonly OverviewPortfolioFlowPoint[],
): OverviewPortfolioFlowRange {
  const enabled = resolveEnabledPortfolioFlowRanges(series);
  if (enabled.includes("1y")) return "1y";
  if (enabled.includes("all")) return "all";
  return enabled[enabled.length - 1] ?? "1m";
}

export function coercePortfolioFlowRange(
  range: OverviewPortfolioFlowRange,
  series: readonly OverviewPortfolioFlowPoint[],
): OverviewPortfolioFlowRange {
  const enabled = resolveEnabledPortfolioFlowRanges(series);
  if (enabled.includes(range)) return range;
  return resolveDefaultPortfolioFlowRange(series);
}

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
  const spread = max - min;
  const relativeFloor = Math.max(Math.abs(max), Math.abs(min)) * 0.02;
  const range = Math.max(spread, relativeFloor, 1);

  return [min - range * 0.12, max + range * 0.12];
}

export type PortfolioFlowChartTone = "profit" | "loss";

export function resolvePortfolioFlowChartTone(
  points: readonly OverviewPortfolioFlowPoint[],
): PortfolioFlowChartTone {
  const last = points[points.length - 1];
  if (!last) return "profit";
  return last.value >= last.invested ? "profit" : "loss";
}

export function resolvePortfolioFlowPointTone(
  point: OverviewPortfolioFlowPoint,
): PortfolioFlowChartTone {
  return point.value >= point.invested ? "profit" : "loss";
}

export const PORTFOLIO_FLOW_CHART_COLORS: Record<
  PortfolioFlowChartTone,
  { stroke: string; cursor: string }
> = {
  profit: {
    stroke: "var(--zynd-emerald)",
    cursor: "var(--zynd-emerald)",
  },
  loss: {
    stroke: "var(--zynd-accent-red)",
    cursor: "var(--zynd-accent-red)",
  },
};
