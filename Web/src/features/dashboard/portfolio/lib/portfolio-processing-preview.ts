import type { OverviewPortfolioFlowPoint } from "@/features/dashboard/overview/lib/overview-portfolio-flow-series";
import type { OverviewPortfolioPreview } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import type { PortfolioSummaryResponse } from "@/features/dashboard/portfolio/lib/portfolio-api";

export function buildProcessingPortfolioPreview(
  pendingInr: number,
  summary: PortfolioSummaryResponse | null | undefined,
): OverviewPortfolioPreview {
  return {
    currentValueInr: pendingInr,
    investedInr: pendingInr,
    totalReturnInr: 0,
    totalReturnPct: 0,
    dayChangeInr: 0,
    dayChangePct: 0,
    xirrPct: 0,
    holdingsCount: 0,
    activeSipsCount: summary?.active_sips_count ?? 0,
    monthlySipInr: summary?.monthly_sip_inr ?? 0,
    growth: [],
    allocation: [],
  };
}

export function buildProcessingPortfolioFlowSeries(
  pendingInr: number,
): OverviewPortfolioFlowPoint[] {
  if (pendingInr <= 0) return [];

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const date = today.toISOString().slice(0, 10);

  return [
    { date, label: "Invested", invested: pendingInr, value: pendingInr },
    { date, label: "Processing", invested: pendingInr, value: pendingInr },
  ];
}
