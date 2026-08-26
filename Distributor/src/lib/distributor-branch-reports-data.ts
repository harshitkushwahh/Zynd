import { DUMMY_BRANCH_DISTRIBUTORS } from "@/lib/distributor-branch-distributors-data";

export type BranchReportRollupPeriod = "mtd" | "last-month";

export type BranchAumSalesRollup = {
  distributorId: string;
  name: string;
  aum: number;
  aumChangeMtdPct: number;
  netSalesMtd: number;
  sipInflowMtd: number;
  redemptionsMtd: number;
};

export const BRANCH_REPORT_ROLLUP_PERIOD_OPTIONS: Array<{
  value: BranchReportRollupPeriod;
  label: string;
}> = [
  { value: "mtd", label: "Month to date" },
  { value: "last-month", label: "Last month" },
];

export type BranchReportTrendPoint = {
  month: string;
  aum: number;
  netSales: number;
};

export type BranchKycPendingRow = {
  id: string;
  clientLabel: string;
  clientCode: string;
  distributorName: string;
  pendingSince: string;
  stage: string;
  daysOpen: number;
};

export type BranchComplianceException = {
  id: string;
  clientLabel: string;
  clientCode: string;
  distributorName: string;
  exceptionType: string;
  severity: "High" | "Medium" | "Low";
  openedAt: string;
  status: "Open" | "In review" | "Resolved";
};

export type BranchScheduledReport = {
  id: string;
  name: string;
  description: string;
  frequency: string;
  recipients: string[];
  lastSentAt: string | null;
  nextRunAt: string;
  enabled: boolean;
};

const MTD_BRANCH_AUM_SALES_ROLLUP: BranchAumSalesRollup[] = [
  {
    distributorId: "bd-1",
    name: "Riya Mehta",
    aum: 4_82_00_000,
    aumChangeMtdPct: 2.4,
    netSalesMtd: 60_50_000,
    sipInflowMtd: 42_00_000,
    redemptionsMtd: 8_20_000,
  },
  {
    distributorId: "bd-2",
    name: "Neha Desai",
    aum: 2_15_00_000,
    aumChangeMtdPct: 1.8,
    netSalesMtd: 50_00_000,
    sipInflowMtd: 28_00_000,
    redemptionsMtd: 5_40_000,
  },
  {
    distributorId: "bd-3",
    name: "Vikram Singh",
    aum: 38_50_000,
    aumChangeMtdPct: 6.2,
    netSalesMtd: 11_00_000,
    sipInflowMtd: 4_20_000,
    redemptionsMtd: 1_10_000,
  },
];

const LAST_MONTH_BRANCH_AUM_SALES_ROLLUP: BranchAumSalesRollup[] = [
  {
    distributorId: "bd-1",
    name: "Riya Mehta",
    aum: 4_71_00_000,
    aumChangeMtdPct: 1.9,
    netSalesMtd: 54_20_000,
    sipInflowMtd: 39_50_000,
    redemptionsMtd: 7_60_000,
  },
  {
    distributorId: "bd-2",
    name: "Neha Desai",
    aum: 2_11_00_000,
    aumChangeMtdPct: 1.2,
    netSalesMtd: 46_80_000,
    sipInflowMtd: 26_40_000,
    redemptionsMtd: 4_90_000,
  },
  {
    distributorId: "bd-3",
    name: "Vikram Singh",
    aum: 36_20_000,
    aumChangeMtdPct: 4.8,
    netSalesMtd: 9_40_000,
    sipInflowMtd: 3_85_000,
    redemptionsMtd: 95_000,
  },
];

export const DUMMY_BRANCH_AUM_SALES_ROLLUP: BranchAumSalesRollup[] = [];
export function getBranchAumSalesRollup(period: BranchReportRollupPeriod): BranchAumSalesRollup[] {
  return period === "mtd" ? MTD_BRANCH_AUM_SALES_ROLLUP : LAST_MONTH_BRANCH_AUM_SALES_ROLLUP;
}

export const BRANCH_KYC_STAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "Address verification", label: "Address verification" },
  { value: "Mobile OTP pending", label: "Mobile OTP pending" },
  { value: "PAN + DigiLocker", label: "PAN + DigiLocker" },
  { value: "Risk profile incomplete", label: "Risk profile incomplete" },
  { value: "NRI documentation", label: "NRI documentation" },
];

export const DUMMY_BRANCH_REPORT_TREND: BranchReportTrendPoint[] = [];

export const DUMMY_BRANCH_KYC_PENDING: BranchKycPendingRow[] = [];

export const DUMMY_BRANCH_COMPLIANCE_EXCEPTIONS: BranchComplianceException[] = [];

export const DUMMY_BRANCH_SCHEDULED_REPORTS: BranchScheduledReport[] = [];

export function getBranchReportSummary() {
  const branchAum = DUMMY_BRANCH_DISTRIBUTORS.reduce((sum, row) => sum + row.aum, 0);
  const netSalesMtd = DUMMY_BRANCH_AUM_SALES_ROLLUP.reduce((sum, row) => sum + row.netSalesMtd, 0);
  const kycPending = DUMMY_BRANCH_KYC_PENDING.length;
  const complianceOpen = DUMMY_BRANCH_COMPLIANCE_EXCEPTIONS.filter(
    (row) => row.status !== "Resolved",
  ).length;
  return { branchAum, netSalesMtd, kycPending, complianceOpen };
}
