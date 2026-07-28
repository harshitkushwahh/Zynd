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

const MTD_DISTRIBUTOR_ROWS: BranchDistributorCommissionRow[] = [
  {
    distributorId: "bd-1",
    name: "Riya Mehta",
    arn: "ARN-884120",
    accrued: 1_84_500,
    released: 1_62_200,
    onHold: 22_300,
    netPayable: 1_62_200,
    payoutStatus: "Partial hold",
  },
  {
    distributorId: "bd-2",
    name: "Neha Desai",
    arn: "ARN-884221",
    accrued: 98_400,
    released: 98_400,
    onHold: 0,
    netPayable: 98_400,
    payoutStatus: "Scheduled",
  },
  {
    distributorId: "bd-3",
    name: "Vikram Singh",
    arn: "ARN-884019",
    accrued: 12_850,
    released: 0,
    onHold: 12_850,
    netPayable: 0,
    payoutStatus: "On hold",
  },
];

const LAST_MONTH_DISTRIBUTOR_ROWS: BranchDistributorCommissionRow[] = [
  {
    distributorId: "bd-1",
    name: "Riya Mehta",
    arn: "ARN-884120",
    accrued: 2_01_800,
    released: 2_01_800,
    onHold: 0,
    netPayable: 2_01_800,
    payoutStatus: "Paid",
  },
  {
    distributorId: "bd-2",
    name: "Neha Desai",
    arn: "ARN-884221",
    accrued: 1_12_600,
    released: 1_12_600,
    onHold: 0,
    netPayable: 1_12_600,
    payoutStatus: "Paid",
  },
  {
    distributorId: "bd-3",
    name: "Vikram Singh",
    arn: "ARN-884019",
    accrued: 8_200,
    released: 6_400,
    onHold: 1_800,
    netPayable: 6_400,
    payoutStatus: "Paid",
  },
];

export const DUMMY_BRANCH_COMMISSION_CATEGORY_MIX: BranchCommissionCategoryMix[] = [
  {
    distributorId: "bd-1",
    name: "Riya",
    equity: 72_000,
    debt: 28_400,
    liquid: 18_200,
    elss: 42_500,
    other: 23_400,
  },
  {
    distributorId: "bd-2",
    name: "Neha",
    equity: 38_200,
    debt: 19_800,
    liquid: 12_400,
    elss: 18_600,
    other: 9_400,
  },
  {
    distributorId: "bd-3",
    name: "Vikram",
    equity: 4_800,
    debt: 2_100,
    liquid: 1_950,
    elss: 2_400,
    other: 1_600,
  },
];

export const DUMMY_BRANCH_COMMISSION_CATEGORIES: BranchCommissionCategoryRow[] = [
  { id: "equity", label: "Equity & hybrid", amount: 1_15_000, sharePct: 41 },
  { id: "elss", label: "ELSS / tax saver", amount: 63_500, sharePct: 23 },
  { id: "debt", label: "Debt & arbitrage", amount: 50_300, sharePct: 18 },
  { id: "liquid", label: "Liquid & overnight", amount: 32_550, sharePct: 12 },
  { id: "other", label: "Others", amount: 17_400, sharePct: 6 },
];

export const DUMMY_BRANCH_COMMISSION_HOLDS: BranchCommissionHoldEntry[] = [
  {
    id: "ch-1",
    distributorId: "bd-1",
    distributorName: "Riya Mehta",
    entryType: "Hold",
    amount: 14_200,
    reason: "SIP installment pending settlement (T+2)",
    txnRef: "TXN-2026-18492",
    settlementStatus: "Pending",
    effectiveAt: "2026-07-26T10:15:00.000Z",
  },
  {
    id: "ch-2",
    distributorId: "bd-1",
    distributorName: "Riya Mehta",
    entryType: "Hold",
    amount: 8_100,
    reason: "Chargeback review — duplicate UPI mandate",
    txnRef: "TXN-2026-18301",
    settlementStatus: "Pending",
    effectiveAt: "2026-07-24T14:40:00.000Z",
  },
  {
    id: "ch-3",
    distributorId: "bd-3",
    distributorName: "Vikram Singh",
    entryType: "Hold",
    amount: 12_850,
    reason: "Distributor onboarding incomplete — EUIN validation",
    txnRef: "—",
    settlementStatus: "Pending",
    effectiveAt: "2026-07-22T09:00:00.000Z",
  },
  {
    id: "ch-4",
    distributorId: "bd-2",
    distributorName: "Neha Desai",
    entryType: "Release",
    amount: 24_600,
    reason: "Prior hold cleared after AMC confirmation",
    txnRef: "TXN-2026-17944",
    settlementStatus: "Settled",
    effectiveAt: "2026-07-21T16:20:00.000Z",
  },
  {
    id: "ch-5",
    distributorId: "bd-1",
    distributorName: "Riya Mehta",
    entryType: "Release",
    amount: 11_500,
    reason: "Lumpsum order settled — trail commission unlocked",
    txnRef: "TXN-2026-17802",
    settlementStatus: "Settled",
    effectiveAt: "2026-07-18T11:05:00.000Z",
  },
];

export const DUMMY_BRANCH_COMMISSION_TREND: BranchCommissionTrendPoint[] = [
  { month: "Feb", accrued: 2_42_000, paid: 2_38_400 },
  { month: "Mar", accrued: 2_68_500, paid: 2_65_100 },
  { month: "Apr", accrued: 2_55_800, paid: 2_55_800 },
  { month: "May", accrued: 2_91_200, paid: 2_88_000 },
  { month: "Jun", accrued: 3_22_600, paid: 3_20_800 },
  { month: "Jul", accrued: 2_95_750, paid: 2_60_600 },
];

export function getBranchCommissionDistributorRows(
  period: BranchCommissionPeriod,
): BranchDistributorCommissionRow[] {
  return period === "mtd" ? MTD_DISTRIBUTOR_ROWS : LAST_MONTH_DISTRIBUTOR_ROWS;
}

export function getBranchCommissionTotals(period: BranchCommissionPeriod) {
  const rows = getBranchCommissionDistributorRows(period);
  const accrued = rows.reduce((sum, row) => sum + row.accrued, 0);
  const released = rows.reduce((sum, row) => sum + row.released, 0);
  const onHold = rows.reduce((sum, row) => sum + row.onHold, 0);
  const netPayable = rows.reduce((sum, row) => sum + row.netPayable, 0);
  return { accrued, released, onHold, netPayable };
}
