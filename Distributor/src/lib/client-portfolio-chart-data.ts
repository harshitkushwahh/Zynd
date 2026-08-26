export type PortfolioChartPeriod = "1D" | "1M" | "6M" | "1Y" | "3Y" | "5Y" | "10Y";

export type PortfolioChartPoint = {
  label: string;
  value: number;
  invested: number;
  date?: string;
};

const PORTFOLIO_CHART_PERIOD_DAYS: Record<PortfolioChartPeriod, number | null> = {
  "1D": 1,
  "1M": 30,
  "6M": 180,
  "1Y": 365,
  "3Y": 365 * 3,
  "5Y": 365 * 5,
  "10Y": null,
};

export const PORTFOLIO_CHART_PERIODS: PortfolioChartPeriod[] = [
  "1D",
  "1M",
  "6M",
  "1Y",
  "3Y",
  "5Y",
  "10Y",
];

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function formatHour(date: Date) {
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function formatDay(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function formatYear(date: Date) {
  return date.toLocaleDateString("en-IN", { year: "numeric" });
}

function buildPoints(
  clientId: string,
  currentValue: number,
  investedAmount: number,
  period: PortfolioChartPeriod,
): PortfolioChartPoint[] {
  const seed = hashSeed(`${clientId}-${period}`);
  const endValue = Math.max(currentValue, 0);
  const endInvested = Math.max(investedAmount, 0);
  const investedRatio =
    endValue > 0 && endInvested > 0 ? endInvested / endValue : 0.82;
  const startScale =
    period === "1D"
      ? 0.998
      : period === "1M"
        ? 0.96
        : period === "6M"
          ? 0.88
          : period === "1Y"
            ? 0.78
            : period === "3Y"
              ? 0.62
              : period === "5Y"
                ? 0.48
                : 0.32;
  const base = endValue > 0 ? endValue * startScale : 10000;
  const target = endValue > 0 ? endValue : base * 1.12;
  const investedTarget = endInvested > 0 ? endInvested : target * investedRatio;
  const investedBase = investedTarget * startScale * 0.94;
  const now = new Date();

  const configs: Record<
    PortfolioChartPeriod,
    { count: number; labelAt: (date: Date) => string; stepMs: number }
  > = {
    "1D": {
      count: 24,
      stepMs: 60 * 60 * 1000,
      labelAt: (date) => formatHour(date),
    },
    "1M": {
      count: 30,
      stepMs: 24 * 60 * 60 * 1000,
      labelAt: (date) => formatDay(date),
    },
    "6M": {
      count: 26,
      stepMs: 7 * 24 * 60 * 60 * 1000,
      labelAt: (date) => formatMonth(date),
    },
    "1Y": {
      count: 12,
      stepMs: 30 * 24 * 60 * 60 * 1000,
      labelAt: (date) => date.toLocaleDateString("en-IN", { month: "short" }),
    },
    "3Y": {
      count: 36,
      stepMs: 30 * 24 * 60 * 60 * 1000,
      labelAt: (date) => formatMonth(date),
    },
    "5Y": {
      count: 60,
      stepMs: 30 * 24 * 60 * 60 * 1000,
      labelAt: (date) => formatMonth(date),
    },
    "10Y": {
      count: 10,
      stepMs: 365 * 24 * 60 * 60 * 1000,
      labelAt: (date) => formatYear(date),
    },
  };

  const { count, stepMs, labelAt } = configs[period];
  const points: PortfolioChartPoint[] = [];

  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getTime() - (count - 1 - i) * stepMs);
    const progress = count <= 1 ? 1 : i / (count - 1);
    const wave = Math.sin((i + (seed % 11)) * 0.65) * 0.035;
    const value = base + (target - base) * progress + target * wave * progress;
    const investedWave = Math.sin((i + (seed % 7)) * 0.4) * 0.015;
    const investedRaw =
      investedBase +
      (investedTarget - investedBase) * progress +
      investedTarget * investedWave * progress;
    const roundedValue = Math.max(0, Math.round(value));
    points.push({
      label: labelAt(date),
      value: roundedValue,
      invested: Math.max(0, Math.min(roundedValue, Math.round(investedRaw))),
    });
  }

  if (points.length > 0 && endValue > 0) {
    points[points.length - 1] = {
      ...points[points.length - 1],
      value: endValue,
      invested: investedTarget,
    };
  }

  return points;
}

export function getPortfolioChartSeries(
  clientId: string,
  currentValue: number,
  period: PortfolioChartPeriod,
  investedAmount = 0,
): PortfolioChartPoint[] {
  return buildPoints(clientId, currentValue, investedAmount, period);
}

export function filterPortfolioChartByPeriod(
  points: readonly PortfolioChartPoint[],
  period: PortfolioChartPeriod,
): PortfolioChartPoint[] {
  if (points.length === 0) return [];

  const datedPoints = points.filter((point) => Boolean(point.date));
  if (datedPoints.length >= 2) {
    const days = PORTFOLIO_CHART_PERIOD_DAYS[period];
    if (days == null) return [...datedPoints];

    const end = new Date(datedPoints[datedPoints.length - 1].date!);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const filtered = datedPoints.filter((point) => new Date(point.date!) >= start);
    if (filtered.length >= 2) return [...filtered];
    return datedPoints.slice(Math.max(0, datedPoints.length - 2));
  }

  return points.length >= 2 ? [...points] : [];
}

export function portfolioChartPeriodDescription(period: PortfolioChartPeriod): string {
  const labels: Record<PortfolioChartPeriod, string> = {
    "1D": "1-day",
    "1M": "1-month",
    "6M": "6-month",
    "1Y": "1-year",
    "3Y": "3-year",
    "5Y": "5-year",
    "10Y": "10-year",
  };
  return `${labels[period]} view of current value (synced snapshot).`;
}

export function portfolioChartPeriodTabLabel(period: PortfolioChartPeriod): string {
  return period;
}

export function portfolioChartPeriodSelectLabel(period: PortfolioChartPeriod): string {
  const labels: Record<PortfolioChartPeriod, string> = {
    "1D": "1 day",
    "1M": "1 month",
    "6M": "6 months",
    "1Y": "1 year",
    "3Y": "3 years",
    "5Y": "5 years",
    "10Y": "All time",
  };
  return labels[period];
}
