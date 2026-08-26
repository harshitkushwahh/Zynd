export type DistributorTxnMix = {
  distributorId: string;
  name: string;
  sipAmount: number;
  lumpsumAmount: number;
};

export type BranchInvestorFunnelStage = {
  id: string;
  label: string;
  count: number;
  hint: string;
};

export type BranchTargetHeatmapCell = {
  distributorId: string;
  distributorName: string;
  year: number;
  month: string;
  attainmentPct: number;
};

export const BRANCH_PERFORMANCE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type BranchPerformanceMonth = (typeof BRANCH_PERFORMANCE_MONTHS)[number];

export const BRANCH_TARGET_ATTAINMENT_YEAR_OPTIONS = [
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
] as const;

export type BranchTargetAttainmentYear =
  (typeof BRANCH_TARGET_ATTAINMENT_YEAR_OPTIONS)[number]["value"];

export const DUMMY_DISTRIBUTOR_TXN_MIX: DistributorTxnMix[] = [];

export const DUMMY_BRANCH_INVESTOR_FUNNEL: BranchInvestorFunnelStage[] = [];

export const DUMMY_BRANCH_TARGET_HEATMAP: BranchTargetHeatmapCell[] = [];

export function getBranchTargetHeatmapForYear(year: BranchTargetAttainmentYear): BranchTargetHeatmapCell[] {
  const numericYear = Number(year);
  return DUMMY_BRANCH_TARGET_HEATMAP.filter((cell) => cell.year === numericYear);
}

export function heatmapAttainmentLevel(pct: number): "low" | "mid" | "high" | "over" {
  if (pct >= 110) return "over";
  if (pct >= 95) return "high";
  if (pct >= 75) return "mid";
  return "low";
}
