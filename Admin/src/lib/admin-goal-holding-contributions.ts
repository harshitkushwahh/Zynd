import type { AdminGoalInvestmentHolding } from "@/lib/admin-api";

export type AdminGoalHoldingContribution = {
  id: string;
  label: string;
  amc: string;
  amountInr: number;
  sharePct: number;
  color: string;
};

const HOLDING_CHART_COLORS = [
  "#3d6b5e",
  "#5a9fd4",
  "#7ec8a8",
  "#d4a574",
  "#94a3b8",
  "#c084fc",
  "#f97316",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
];

export function mapGoalHoldingsToContributions(
  holdings: AdminGoalInvestmentHolding[],
): AdminGoalHoldingContribution[] {
  const grouped = new Map<
    string,
    { id: string; label: string; amc: string; amountInr: number }
  >();

  for (const holding of holdings) {
    const label = holding.matched_scheme_name ?? holding.scheme_name;
    const key = holding.isin || label;
    const amountInr = holding.market_value_inr ?? 0;
    if (amountInr <= 0) continue;

    const existing = grouped.get(key);
    if (existing) {
      existing.amountInr += amountInr;
      continue;
    }

    grouped.set(key, {
      id: key,
      label,
      amc: holding.amc_name ?? "",
      amountInr,
    });
  }

  const items = [...grouped.values()].sort((left, right) => right.amountInr - left.amountInr);
  const total = items.reduce((sum, item) => sum + item.amountInr, 0);

  return items.map((item, index) => ({
    ...item,
    sharePct: total > 0 ? Math.round((item.amountInr / total) * 100) : 0,
    color: HOLDING_CHART_COLORS[index % HOLDING_CHART_COLORS.length],
  }));
}

export function sumGoalHoldingContributions(contributions: AdminGoalHoldingContribution[]) {
  return contributions.reduce((total, item) => total + item.amountInr, 0);
}
