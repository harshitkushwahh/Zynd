import type { PortfolioSummaryResponse } from "@/features/dashboard/portfolio/lib/portfolio-api";
import type { MfInvestedPreview } from "@/features/invest/lib/mf-dashboard-sidebar-data";

export function mapPortfolioSummaryToInvestedPreview(
  summary: PortfolioSummaryResponse,
): MfInvestedPreview {
  const growthPoints = summary.growth
    .filter((point) => point.value > 0)
    .map((point) => ({
      label: point.label,
      value: point.value,
    }));

  const dayChangePoints =
    growthPoints.length >= 2
      ? growthPoints
      : summary.current_value_inr > 0
        ? [
            { label: "Invested", value: summary.invested_inr },
            { label: "Current", value: summary.current_value_inr },
          ]
        : [];

  return {
    totalValueInr: summary.current_value_inr,
    investedInr: summary.invested_inr,
    totalReturnPct: summary.total_return_pct,
    dayChangePct: summary.day_change_pct,
    dayChangePoints,
  };
}

export function portfolioSummaryHasInvestments(summary: PortfolioSummaryResponse): boolean {
  return (
    summary.holdings_count > 0 ||
    summary.current_value_inr > 0 ||
    summary.invested_inr > 0 ||
    summary.has_pending_orders
  );
}
