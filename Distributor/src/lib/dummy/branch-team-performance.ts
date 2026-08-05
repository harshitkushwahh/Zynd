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

export const DUMMY_DISTRIBUTOR_TXN_MIX: DistributorTxnMix[] = [
  { distributorId: "bd-1", name: "Riya Mehta", sipAmount: 42_00_000, lumpsumAmount: 18_50_000 },
  { distributorId: "bd-2", name: "Neha Desai", sipAmount: 28_00_000, lumpsumAmount: 22_00_000 },
  { distributorId: "bd-3", name: "Vikram Singh", sipAmount: 4_20_000, lumpsumAmount: 6_80_000 },
];

export const DUMMY_BRANCH_INVESTOR_FUNNEL: BranchInvestorFunnelStage[] = [
  { id: "leads", label: "Leads captured", count: 420, hint: "Branch CRM & referrals" },
  { id: "kyc-started", label: "KYC started", count: 286, hint: "DigiLocker / PAN initiated" },
  { id: "kyc-done", label: "KYC completed", count: 214, hint: "Ready to invest" },
  { id: "first-txn", label: "First investment", count: 168, hint: "Lumpsum or SIP registered" },
  { id: "active-sip", label: "Active SIP", count: 132, hint: "SIP still running" },
];

export const DUMMY_BRANCH_TARGET_HEATMAP: BranchTargetHeatmapCell[] = [
  // 2026 — H1
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Jan", attainmentPct: 92 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Feb", attainmentPct: 105 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Mar", attainmentPct: 118 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Apr", attainmentPct: 97 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "May", attainmentPct: 111 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Jun", attainmentPct: 88 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Jul", attainmentPct: 102 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Aug", attainmentPct: 94 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Sep", attainmentPct: 108 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Oct", attainmentPct: 115 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Nov", attainmentPct: 99 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2026, month: "Dec", attainmentPct: 106 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Jan", attainmentPct: 78 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Feb", attainmentPct: 84 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Mar", attainmentPct: 91 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Apr", attainmentPct: 102 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "May", attainmentPct: 96 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Jun", attainmentPct: 109 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Jul", attainmentPct: 101 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Aug", attainmentPct: 88 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Sep", attainmentPct: 95 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Oct", attainmentPct: 103 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Nov", attainmentPct: 97 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2026, month: "Dec", attainmentPct: 112 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Jan", attainmentPct: 45 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Feb", attainmentPct: 52 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Mar", attainmentPct: 61 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Apr", attainmentPct: 58 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "May", attainmentPct: 72 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Jun", attainmentPct: 68 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Jul", attainmentPct: 74 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Aug", attainmentPct: 79 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Sep", attainmentPct: 83 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Oct", attainmentPct: 86 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Nov", attainmentPct: 91 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2026, month: "Dec", attainmentPct: 88 },
  // 2025
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Jan", attainmentPct: 88 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Feb", attainmentPct: 91 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Mar", attainmentPct: 99 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Apr", attainmentPct: 104 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "May", attainmentPct: 96 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Jun", attainmentPct: 101 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Jul", attainmentPct: 93 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Aug", attainmentPct: 107 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Sep", attainmentPct: 100 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Oct", attainmentPct: 112 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Nov", attainmentPct: 98 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", year: 2025, month: "Dec", attainmentPct: 109 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Jan", attainmentPct: 72 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Feb", attainmentPct: 79 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Mar", attainmentPct: 86 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Apr", attainmentPct: 90 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "May", attainmentPct: 94 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Jun", attainmentPct: 88 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Jul", attainmentPct: 92 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Aug", attainmentPct: 85 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Sep", attainmentPct: 98 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Oct", attainmentPct: 91 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Nov", attainmentPct: 104 },
  { distributorId: "bd-2", distributorName: "Neha Desai", year: 2025, month: "Dec", attainmentPct: 99 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Jan", attainmentPct: 38 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Feb", attainmentPct: 41 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Mar", attainmentPct: 47 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Apr", attainmentPct: 50 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "May", attainmentPct: 55 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Jun", attainmentPct: 59 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Jul", attainmentPct: 62 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Aug", attainmentPct: 58 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Sep", attainmentPct: 64 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Oct", attainmentPct: 67 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Nov", attainmentPct: 71 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", year: 2025, month: "Dec", attainmentPct: 69 },
];

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
