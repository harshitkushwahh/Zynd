import { DUMMY_BRANCH_DISTRIBUTORS } from "@/lib/dummy/branch-distributors";

export type BranchAumSalesRollup = {
  distributorId: string;
  name: string;
  aum: number;
  aumChangeMtdPct: number;
  netSalesMtd: number;
  sipInflowMtd: number;
  redemptionsMtd: number;
};

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

export const DUMMY_BRANCH_AUM_SALES_ROLLUP: BranchAumSalesRollup[] = [
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

export const DUMMY_BRANCH_REPORT_TREND: BranchReportTrendPoint[] = [
  { month: "Feb", aum: 6_82_00_000, netSales: 92_00_000 },
  { month: "Mar", aum: 6_95_00_000, netSales: 98_50_000 },
  { month: "Apr", aum: 7_08_00_000, netSales: 88_20_000 },
  { month: "May", aum: 7_18_00_000, netSales: 1_04_00_000 },
  { month: "Jun", aum: 7_28_00_000, netSales: 1_12_00_000 },
  { month: "Jul", aum: 7_35_50_000, netSales: 1_21_50_000 },
];

export const DUMMY_BRANCH_KYC_PENDING: BranchKycPendingRow[] = [
  {
    id: "kyc-r-1",
    clientLabel: "Client ···0191",
    clientCode: "ZYD0000191",
    distributorName: "Riya Mehta",
    pendingSince: "2026-07-08T15:10:00.000Z",
    stage: "Address verification",
    daysOpen: 19,
  },
  {
    id: "kyc-r-2",
    clientLabel: "Client ···0193",
    clientCode: "ZYD0000193",
    distributorName: "Neha Desai",
    pendingSince: "2026-06-16T11:40:00.000Z",
    stage: "Mobile OTP pending",
    daysOpen: 41,
  },
  {
    id: "kyc-r-3",
    clientLabel: "Client ···0192",
    clientCode: "ZYD0000192",
    distributorName: "Riya Mehta",
    pendingSince: "2026-06-11T08:05:00.000Z",
    stage: "PAN + DigiLocker",
    daysOpen: 46,
  },
  {
    id: "kyc-r-4",
    clientLabel: "Client ···0183",
    clientCode: "ZYD0000183",
    distributorName: "Neha Desai",
    pendingSince: "2026-06-08T09:28:00.000Z",
    stage: "Risk profile incomplete",
    daysOpen: 49,
  },
  {
    id: "kyc-r-5",
    clientLabel: "Client ···0178",
    clientCode: "ZYD0000178",
    distributorName: "Vikram Singh",
    pendingSince: "2026-05-22T06:55:00.000Z",
    stage: "NRI documentation",
    daysOpen: 66,
  },
];

export const DUMMY_BRANCH_COMPLIANCE_EXCEPTIONS: BranchComplianceException[] = [
  {
    id: "cx-r-1",
    clientLabel: "Rahul S.",
    clientCode: "ZYD0000186",
    distributorName: "Riya Mehta",
    exceptionType: "CKYC mismatch — name variance",
    severity: "High",
    openedAt: "2026-07-20T09:00:00.000Z",
    status: "Open",
  },
  {
    id: "cx-r-2",
    clientLabel: "Client ···0190",
    clientCode: "ZYD0000190",
    distributorName: "Neha Desai",
    exceptionType: "PEP screening hit — review required",
    severity: "High",
    openedAt: "2026-07-18T14:30:00.000Z",
    status: "In review",
  },
  {
    id: "cx-r-3",
    clientLabel: "Client ···0182",
    clientCode: "ZYD0000182",
    distributorName: "Riya Mehta",
    exceptionType: "Missing FATCA self-cert (NRI)",
    severity: "Medium",
    openedAt: "2026-07-12T11:15:00.000Z",
    status: "Open",
  },
  {
    id: "cx-r-4",
    clientLabel: "Tanvi R.",
    clientCode: "ZYD0000176",
    distributorName: "Neha Desai",
    exceptionType: "Expired identity document",
    severity: "Medium",
    openedAt: "2026-07-05T08:45:00.000Z",
    status: "In review",
  },
  {
    id: "cx-r-5",
    clientLabel: "Client ···0184",
    clientCode: "ZYD0000184",
    distributorName: "Vikram Singh",
    exceptionType: "Bank mandate signature mismatch",
    severity: "Low",
    openedAt: "2026-06-28T16:00:00.000Z",
    status: "Resolved",
  },
];

export const DUMMY_BRANCH_SCHEDULED_REPORTS: BranchScheduledReport[] = [
  {
    id: "sr-1",
    name: "Daily branch AUM snapshot",
    description: "Closing AUM by distributor and product category for HO finance.",
    frequency: "Every business day · 7:00 AM IST",
    recipients: ["ho-finance@zynd.in", "branch-ops-west@zynd.in"],
    lastSentAt: "2026-07-27T01:30:00.000Z",
    nextRunAt: "2026-07-28T01:30:00.000Z",
    enabled: true,
  },
  {
    id: "sr-2",
    name: "Weekly net sales roll-up",
    description: "Gross inflow, redemptions, and net sales by distributor.",
    frequency: "Mondays · 8:30 AM IST",
    recipients: ["ho-sales@zynd.in", "arjun@zynd.distributor"],
    lastSentAt: "2026-07-21T03:00:00.000Z",
    nextRunAt: "2026-07-28T03:00:00.000Z",
    enabled: true,
  },
  {
    id: "sr-3",
    name: "KYC pending digest",
    description: "Open onboarding cases older than 7 days for branch follow-up.",
    frequency: "Wednesdays · 9:00 AM IST",
    recipients: ["compliance-west@zynd.in", "arjun@zynd.distributor"],
    lastSentAt: "2026-07-23T03:30:00.000Z",
    nextRunAt: "2026-07-30T03:30:00.000Z",
    enabled: true,
  },
  {
    id: "sr-4",
    name: "Compliance exception pack",
    description: "Open and in-review exceptions with severity for HO compliance.",
    frequency: "1st of month · 6:00 AM IST",
    recipients: ["compliance@zynd.in", "ho-risk@zynd.in"],
    lastSentAt: "2026-07-01T00:30:00.000Z",
    nextRunAt: "2026-08-01T00:30:00.000Z",
    enabled: false,
  },
];

export function getBranchReportSummary() {
  const branchAum = DUMMY_BRANCH_DISTRIBUTORS.reduce((sum, row) => sum + row.aum, 0);
  const netSalesMtd = DUMMY_BRANCH_AUM_SALES_ROLLUP.reduce((sum, row) => sum + row.netSalesMtd, 0);
  const kycPending = DUMMY_BRANCH_KYC_PENDING.length;
  const complianceOpen = DUMMY_BRANCH_COMPLIANCE_EXCEPTIONS.filter(
    (row) => row.status !== "Resolved",
  ).length;
  return { branchAum, netSalesMtd, kycPending, complianceOpen };
}
