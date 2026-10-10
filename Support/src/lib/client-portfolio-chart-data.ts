export type PortfolioChartPeriod = "1D" | "1M" | "6M" | "1Y" | "3Y" | "5Y" | "10Y";

/** Client detail portfolio chart — shorter period menu. */
export type ClientPortfolioChartPeriod = "1D" | "1M" | "all";

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

const CLIENT_PORTFOLIO_CHART_PERIOD_DAYS: Record<ClientPortfolioChartPeriod, number | null> = {
  "1D": 1,
  "1M": 30,
  all: null,
};

export const CLIENT_PORTFOLIO_CHART_PERIODS: ClientPortfolioChartPeriod[] = ["1D", "1M", "all"];

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

function trimLeadingEmptyPoints(points: readonly PortfolioChartPoint[]): PortfolioChartPoint[] {
  const firstActive = points.findIndex((point) => point.value > 0 || point.invested > 0);
  if (firstActive <= 0) return [...points];
  return points.slice(firstActive);
}

function isActivePortfolioChartPoint(point: PortfolioChartPoint): boolean {
  return point.value > 0 || point.invested > 0;
}

function compactActivePortfolioChartPoints(points: readonly PortfolioChartPoint[]): PortfolioChartPoint[] {
  return points.filter(isActivePortfolioChartPoint);
}

function relabelPortfolioChartPoints(points: readonly PortfolioChartPoint[]): PortfolioChartPoint[] {
  const historyDays = portfolioChartHistoryDays(points);

  return points.map((point) => {
    if (!point.date) return point;
    const date = new Date(`${point.date}T12:00:00`);
    if (Number.isNaN(date.getTime())) return point;

    const label =
      historyDays <= 45
        ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        : date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

    return { ...point, label };
  });
}

function normalizePortfolioChartSeries(points: readonly PortfolioChartPoint[]): PortfolioChartPoint[] {
  return trimLeadingEmptyPoints(
    points.map((point) => ({
      ...point,
      value: Math.max(0, Number(point.value) || 0),
      invested: Math.max(0, Number(point.invested) || 0),
    })),
  );
}

export function buildPortfolioChartFallbackSeries(
  currentValue: number,
  investedAmount: number,
): PortfolioChartPoint[] {
  if (currentValue <= 0 && investedAmount <= 0) return [];

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 1);

  return relabelPortfolioChartPoints([
    {
      label: "",
      value: investedAmount,
      invested: investedAmount,
      date: start.toISOString().slice(0, 10),
    },
    {
      label: "",
      value: currentValue,
      invested: investedAmount,
      date: end.toISOString().slice(0, 10),
    },
  ]);
}

export function resolveClientPortfolioChartSeries(
  series: readonly PortfolioChartPoint[],
  currentValue: number,
  investedAmount: number,
): PortfolioChartPoint[] {
  const normalized = normalizePortfolioChartSeries(series);
  const active = compactActivePortfolioChartPoints(normalized);
  const historyDays = portfolioChartHistoryDays(active);

  if (active.length <= 3 || historyDays <= 45) {
    return buildPortfolioChartFallbackSeries(currentValue, investedAmount);
  }

  const next = active.map((point) => ({ ...point }));
  const last = next[next.length - 1];
  next[next.length - 1] = {
    ...last,
    value: currentValue > 0 ? currentValue : last.value,
    invested: investedAmount > 0 ? investedAmount : last.invested,
  };

  return relabelPortfolioChartPoints(next);
}

export function portfolioChartHistoryDays(points: readonly PortfolioChartPoint[]): number {
  const dated = points.filter((point) => point.date);
  if (dated.length < 2) return dated.length > 0 ? 0 : 0;

  const start = new Date(dated[0].date!);
  const end = new Date(dated[dated.length - 1].date!);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

export function isClientPortfolioChartPeriodEnabled(
  period: ClientPortfolioChartPeriod,
  historyDays: number,
  hasData: boolean,
): boolean {
  if (!hasData) return false;
  if (period === "all" || period === "1D") return true;
  if (period === "1M") return historyDays >= 28;
  return false;
}

export function resolveDefaultClientPortfolioChartPeriod(
  series: readonly PortfolioChartPoint[],
): ClientPortfolioChartPeriod {
  const enabled = resolveEnabledClientPortfolioChartPeriods(series);
  if (enabled.includes("1M")) return "1M";
  if (enabled.includes("1D")) return "1D";
  return enabled.includes("all") ? "all" : "1D";
}

export function resolveEnabledClientPortfolioChartPeriods(
  series: readonly PortfolioChartPoint[],
): ClientPortfolioChartPeriod[] {
  const historyDays = portfolioChartHistoryDays(series);
  const hasData = series.length > 0;

  return CLIENT_PORTFOLIO_CHART_PERIODS.filter((period) =>
    isClientPortfolioChartPeriodEnabled(period, historyDays, hasData),
  );
}

export function coerceClientPortfolioChartPeriod(
  period: ClientPortfolioChartPeriod,
  series: readonly PortfolioChartPoint[],
): ClientPortfolioChartPeriod {
  const enabled = resolveEnabledClientPortfolioChartPeriods(series);
  if (enabled.includes(period)) return period;
  return resolveDefaultClientPortfolioChartPeriod(series);
}

export function filterClientPortfolioChartByPeriod(
  points: readonly PortfolioChartPoint[],
  period: ClientPortfolioChartPeriod,
): PortfolioChartPoint[] {
  if (points.length === 0) return [];

  const source = relabelPortfolioChartPoints(compactActivePortfolioChartPoints(points));
  if (source.length === 0) return [];

  const days = CLIENT_PORTFOLIO_CHART_PERIOD_DAYS[period];
  if (days == null || source.every((point) => !point.date)) {
    return source.length >= 2
      ? source
      : buildPortfolioChartFallbackSeries(
          source[source.length - 1]?.value ?? 0,
          source[source.length - 1]?.invested ?? 0,
        );
  }

  const end = new Date(`${source[source.length - 1].date!}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const filtered = source.filter((point) => new Date(`${point.date!}T12:00:00`) >= start);
  if (filtered.length >= 2) return filtered;

  return source.length >= 2 ? source : buildPortfolioChartFallbackSeries(
    source[source.length - 1]?.value ?? 0,
    source[source.length - 1]?.invested ?? 0,
  );
}

export function filterPortfolioChartByPeriod(
  points: readonly PortfolioChartPoint[],
  period: PortfolioChartPeriod,
): PortfolioChartPoint[] {
  if (points.length === 0) return [];

  const datedPoints = points.filter((point) => Boolean(point.date));
  const source = trimLeadingEmptyPoints(datedPoints.length >= 2 ? datedPoints : points);
  if (source.length === 0) return [];

  const days = PORTFOLIO_CHART_PERIOD_DAYS[period];
  if (days == null || source.every((point) => !point.date)) {
    return source.length >= 2 ? source : [];
  }

  const end = new Date(source[source.length - 1].date!);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const filtered = source.filter((point) => new Date(point.date!) >= start);
  if (filtered.length >= 2) return filtered;
  return source.length >= 2 ? source : [];
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

export function clientPortfolioChartPeriodSelectLabel(period: ClientPortfolioChartPeriod): string {
  const labels: Record<ClientPortfolioChartPeriod, string> = {
    "1D": "1 day",
    "1M": "1 month",
    all: "All",
  };
  return labels[period];
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
