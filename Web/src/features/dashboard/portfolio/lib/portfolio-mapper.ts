import type { OverviewPortfolioFlowPoint } from "@/features/dashboard/overview/lib/overview-portfolio-flow-series";
import type { OverviewPortfolioPreview } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import type {
  PortfolioGrowthPoint,
  PortfolioHoldingDetailResponse,
  PortfolioHoldingResponse,
  PortfolioSummaryResponse,
} from "@/features/dashboard/portfolio/lib/portfolio-api";
import type { PortfolioHoldingDetail } from "@/features/dashboard/portfolio/lib/portfolio-holding-detail-data";
import type { PortfolioHoldingItem } from "@/features/dashboard/portfolio/lib/portfolio-types";

export function mapPortfolioSummaryToPreview(
  summary: PortfolioSummaryResponse,
): OverviewPortfolioPreview {
  return {
    currentValueInr: summary.current_value_inr,
    investedInr: summary.invested_inr,
    totalReturnInr: summary.total_return_inr,
    totalReturnPct: summary.total_return_pct,
    dayChangeInr: summary.day_change_inr ?? 0,
    dayChangePct: summary.day_change_pct ?? 0,
    xirrPct: summary.xirr_pct ?? 0,
    holdingsCount: summary.holdings_count,
    activeSipsCount: summary.active_sips_count,
    monthlySipInr: summary.monthly_sip_inr,
    growth: summary.growth.map((point) => ({
      label: point.label,
      value: point.value,
    })),
    allocation: summary.allocation.map((slice) => ({
      id: slice.id,
      label: slice.label,
      valuePct: slice.value_pct,
      color: slice.color,
    })),
  };
}

export function mapPortfolioGrowthToFlowSeries(
  growth: PortfolioGrowthPoint[],
): OverviewPortfolioFlowPoint[] {
  const datedPoints = growth.filter((point) => Boolean(point.date));
  if (datedPoints.length >= 2) {
    return datedPoints.map((point) => ({
      date: point.date!,
      label: point.label,
      invested: point.invested ?? point.value,
      value: point.value,
    }));
  }

  if (growth.length < 2) return [];

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setMonth(start.getMonth() - 1);

  const investedPoint = growth.find((point) => point.label.toLowerCase() === "invested") ?? growth[0]!;
  const currentPoint =
    growth.find((point) => point.label.toLowerCase() === "current") ?? growth[growth.length - 1]!;

  return [
    {
      date: start.toISOString().slice(0, 10),
      label: start.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      invested: investedPoint.invested ?? investedPoint.value,
      value: investedPoint.value,
    },
    {
      date: today.toISOString().slice(0, 10),
      label: today.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      invested: investedPoint.invested ?? investedPoint.value,
      value: currentPoint.value,
    },
  ];
}

export function mapPortfolioHoldingToItem(holding: PortfolioHoldingResponse): PortfolioHoldingItem {
  return {
    id: holding.id,
    fundName: holding.fund_name,
    amcName: holding.amc_name ?? "Mutual fund",
    currentValueInr: holding.current_value_inr,
    investedInr: holding.invested_inr,
    returnPct: holding.return_pct,
    allocationPct: holding.allocation_pct,
  };
}

export function portfolioSummaryHasDayChange(summary: PortfolioSummaryResponse) {
  return summary.day_change_inr != null && summary.day_change_pct != null;
}

export function mapPortfolioHoldingDetail(
  holding: PortfolioHoldingDetailResponse,
): PortfolioHoldingDetail {
  return {
    id: holding.id,
    fundName: holding.fund_name,
    amcName: holding.amc_name ?? "Mutual fund",
    currentValueInr: holding.current_value_inr,
    investedInr: holding.invested_inr,
    returnPct: holding.return_pct,
    allocationPct: holding.allocation_pct,
    folioNumber: holding.folio_number,
    holdingMode: holding.holding_mode === "Demat" ? "Demat" : "Physical",
    investedMonths: holding.invested_months,
    currentNav: holding.current_nav ?? holding.nav ?? 0,
    avgNav: holding.avg_nav,
    returnInr: holding.return_inr,
    dayChangePct: holding.day_change_pct,
    dayChangeInr: holding.day_change_inr,
    xirrPct: holding.xirr_pct,
    redeemableUnits: holding.redeemable_units,
    redeemBankLabel: holding.redeem_bank_label,
    nomineeName: holding.nominee_name,
    transactions: holding.transactions.map((txn) => ({
      id: txn.id,
      date: txn.date,
      type: txn.type as PortfolioHoldingDetail["transactions"][number]["type"],
      units: txn.units,
      nav: txn.nav,
      valueInr: txn.value_inr,
    })),
  };
}

export function portfolioHoldingHasDayChange(holding: PortfolioHoldingDetailResponse) {
  return holding.day_change_inr != null && holding.day_change_pct != null;
}
