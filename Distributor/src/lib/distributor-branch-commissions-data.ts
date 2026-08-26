export type BranchCommissionPeriod = "mtd" | "last-month";

export type BranchDistributorCommissionRow = {
  distributorId: string;
  name: string;
  arn: string;
  accrued: number;
  released: number;
  onHold: number;
  netPayable: number;
  payoutStatus: "Scheduled" | "Partial hold" | "On hold" | "Paid";
};

export type BranchCommissionCategoryRow = {
  id: string;
  label: string;
  amount: number;
  sharePct: number;
};

export type BranchCommissionCategoryMix = {
  distributorId: string;
  name: string;
  equity: number;
  debt: number;
  liquid: number;
  elss: number;
  other: number;
};

export type BranchCommissionHoldEntry = {
  id: string;
  distributorId: string;
  distributorName: string;
  entryType: "Hold" | "Release";
  amount: number;
  reason: string;
  txnRef: string;
  settlementStatus: "Pending" | "Settled" | "Reversed";
  effectiveAt: string;
};

export type BranchCommissionTrendPoint = {
  month: string;
  accrued: number;
  paid: number;
};

export const BRANCH_COMMISSION_PERIOD_OPTIONS: Array<{
  value: BranchCommissionPeriod;
  label: string;
}> = [
  { value: "mtd", label: "Month to date" },
  { value: "last-month", label: "Last month" },
];

export const BRANCH_COMMISSION_CATEGORY_MIX: BranchCommissionCategoryMix[] = [];

export const BRANCH_COMMISSION_CATEGORIES: BranchCommissionCategoryRow[] = [];

export const BRANCH_COMMISSION_HOLDS: BranchCommissionHoldEntry[] = [];

export const BRANCH_COMMISSION_TREND: BranchCommissionTrendPoint[] = [];

export function getBranchCommissionDistributorRows(
  _period: BranchCommissionPeriod,
): BranchDistributorCommissionRow[] {
  return [];
}

export function getBranchCommissionTotals(period: BranchCommissionPeriod) {
  const rows = getBranchCommissionDistributorRows(period);
  const accrued = rows.reduce((sum, row) => sum + row.accrued, 0);
  const released = rows.reduce((sum, row) => sum + row.released, 0);
  const onHold = rows.reduce((sum, row) => sum + row.onHold, 0);
  const netPayable = rows.reduce((sum, row) => sum + row.netPayable, 0);
  return { accrued, released, onHold, netPayable };
}
