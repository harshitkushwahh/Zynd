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
  month: string;
  attainmentPct: number;
};

export const BRANCH_PERFORMANCE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"] as const;

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
  { distributorId: "bd-1", distributorName: "Riya Mehta", month: "Jan", attainmentPct: 92 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", month: "Feb", attainmentPct: 105 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", month: "Mar", attainmentPct: 118 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", month: "Apr", attainmentPct: 97 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", month: "May", attainmentPct: 111 },
  { distributorId: "bd-1", distributorName: "Riya Mehta", month: "Jun", attainmentPct: 88 },
  { distributorId: "bd-2", distributorName: "Neha Desai", month: "Jan", attainmentPct: 78 },
  { distributorId: "bd-2", distributorName: "Neha Desai", month: "Feb", attainmentPct: 84 },
  { distributorId: "bd-2", distributorName: "Neha Desai", month: "Mar", attainmentPct: 91 },
  { distributorId: "bd-2", distributorName: "Neha Desai", month: "Apr", attainmentPct: 102 },
  { distributorId: "bd-2", distributorName: "Neha Desai", month: "May", attainmentPct: 96 },
  { distributorId: "bd-2", distributorName: "Neha Desai", month: "Jun", attainmentPct: 109 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", month: "Jan", attainmentPct: 45 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", month: "Feb", attainmentPct: 52 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", month: "Mar", attainmentPct: 61 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", month: "Apr", attainmentPct: 58 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", month: "May", attainmentPct: 72 },
  { distributorId: "bd-3", distributorName: "Vikram Singh", month: "Jun", attainmentPct: 68 },
];

export function heatmapAttainmentLevel(pct: number): "low" | "mid" | "high" | "over" {
  if (pct >= 110) return "over";
  if (pct >= 95) return "high";
  if (pct >= 75) return "mid";
  return "low";
}
