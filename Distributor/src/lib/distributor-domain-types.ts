// Domain types extracted from former dummy modules.

import type { DistributorProfileAddress } from "@/lib/distributor-profile";

export type DistributorComplianceIssueType =
  | "KYC pending"
  | "eSign pending"
  | "Bank verification"
  | "Nominee incomplete"
  | "Document expiring"
  | "Compliance exception";

export type DistributorSalaryPaymentStatus = "waiting" | "done" | "partial" | "failed";
export type DistributorWorkLocationType = "Office" | "Client site" | "Home";
export type DistributorWorkAttendanceStatus = "complete" | "partial" | "leave" | "holiday";
export type DistributorLeaveType = "Annual" | "Sick" | "Casual" | "Unpaid";
export type DistributorLeaveRequestStatus = "Pending" | "Approved" | "Rejected";
export type DistributorLeadStage = "New" | "Contacted" | "Qualified" | "Converted" | "Lost";
export type DistributorLeadSource = "Referral" | "Walk-in" | "Digital" | "Campaign" | "Other";
export type DistributorPayoutStatus = "Scheduled" | "Processing" | "Paid" | "Failed";
export type DistributorReportFormat = "PDF" | "Excel" | "CSV";
export type DistributorNotificationKind = "order" | "kyc" | "compliance" | "payout" | "system";
export type SalaryPayoutStatus = "scheduled" | "processing" | "paid" | "failed";
export type BranchReportRollupPeriod = "mtd" | "last-month";

export type BranchDistributorStatus =
  | "Active"
  | "Former"
  | "Paused"
  | "Pending review"
  | "Pending password"
  | "Rejected";

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

export type BranchDistributorWorkSnapshot = {
  compensation: DistributorJobCompensation;
  performance: DistributorJobPerformanceCalc;
  leaveBalances: DistributorLeaveBalance[];
  leaveRequests: DistributorLeaveRequest[];
  attendanceRows: DistributorWorkAttendanceRow[];
  workHours: DistributorJobWorkHours;
  commissionRow: BranchDistributorCommissionRow | undefined;
  commissionHolds: BranchCommissionHoldEntry[];
};

export type BranchDistributorBookHolding = {
  id: string;
  schemeName: string;
  amcName: string;
  totalAum: number;
  clientCount: number;
  sipSharePct: number;
};

export type BranchDistributorProfile = BranchDistributorRecord & {
  avatarUrl?: string | null;
  mobile: string;
  mobileMasked: string;
  branchName: string;
  address: DistributorProfileAddress;
  euin: string;
  activeSipCount: number;
  mtdInflow: number;
  lumpsumMtd: number;
  onboardingCompletePct: number;
  featuredInvestorIds: string[];
  bookHoldings: BranchDistributorBookHolding[];
};

export type BranchDistributorRecord = {
  id: string;
  name: string;
  email: string;
  arn: string;
  clientCount: number;
  aum: number;
  status: BranchDistributorStatus;
  joinedAt: string;
};

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

export type DistributorComplianceQueueRow = {
  id: string;
  clientId: string;
  clientCode: string;
  clientLabel: string;
  issueType: DistributorComplianceIssueType;
  stage: string;
  severity: "High" | "Medium" | "Low";
  daysOpen: number;
  updatedAt: string;
};

export type DistributorJobCompensation = {
  id: string;
  periodLabel: string;
  basicSalary: number;
  performanceIncentive: number;
  spotBonus: number;
  deductions: number;
  takeHome: number;
  paymentStatus: DistributorSalaryPaymentStatus;
  paidOn: string | null;
};

export type DistributorPayrollPromotion = {
  label: string;
  previousBaseSalary: number;
  newBaseSalary: number;
  hikePct: number;
  effectiveLabel: string;
};

export type DistributorJobPerformanceCalc = {
  netSalesTarget: number;
  netSalesAchieved: number;
  achievementPct: number;
  incentiveSlab: number;
  calculatedIncentive: number;
  adjustments: number;
  finalIncentive: number;
};

export type DistributorJobWorkDay = {
  day: string;
  hours: number;
  status: "present" | "half-day" | "leave" | "holiday";
};

export type DistributorWorkAttendanceRow = {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number;
  workType: DistributorWorkLocationType | null;
  payFactor: number;
  status: DistributorWorkAttendanceStatus;
};

export type DistributorJobWorkHours = {
  weekLabel: string;
  totalHours: number;
  targetHours: number;
  trendPct: number;
  avgDailyHours: number;
  overtimeHours: number;
  daily: DistributorJobWorkDay[];
};

export type DistributorLeaveBalance = {
  type: DistributorLeaveType;
  total: number;
  used: number;
  remaining: number;
};

export type DistributorLeaveRequest = {
  id: string;
  type: DistributorLeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: DistributorLeaveRequestStatus;
  appliedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type DistributorSalarySlipRow = {
  id: string;
  payrollId: string;
  periodLabel: string;
  basicSalary: number;
  performanceIncentive: number;
  spotBonus: number;
  deductions: number;
  takeHome: number;
  status: DistributorSalaryPaymentStatus;
  paidOn: string;
};

export type DistributorWorkAttendanceChartPoint = {
  id: string;
  label: string;
  hours: number;
  weightedHours: number;
  workType: DistributorWorkLocationType | null;
  status: DistributorWorkAttendanceStatus;
  fill: string;
};

export type DistributorLeadRow = {
  id: string;
  clientId: string;
  clientCode: string;
  clientLabel: string;
  emailMasked: string;
  stage: DistributorLeadStage;
  source: DistributorLeadSource;
  lastActivityAt: string;
  daysInStage: number;
};

export type DistributorPayoutRow = {
  id: string;
  payoutRef: string;
  periodLabel: string;
  grossAmount: number;
  holdAmount: number;
  netAmount: number;
  status: DistributorPayoutStatus;
  settlementDate: string;
  bankAccountMasked: string;
};

export type DistributorNetSalesTrendPoint = {
  month: string;
  netSales: number;
};

export type DistributorNetSalesChartPeriod = "1M" | "6M" | "1Y" | "3Y" | "5Y" | "10Y";

export const DISTRIBUTOR_NET_SALES_CHART_PERIODS: DistributorNetSalesChartPeriod[] = [
  "1M",
  "6M",
  "1Y",
  "3Y",
  "5Y",
  "10Y",
];

const NET_SALES_PERIOD_POINT_COUNT: Record<DistributorNetSalesChartPeriod, number> = {
  "1M": 2,
  "6M": 6,
  "1Y": 12,
  "3Y": 36,
  "5Y": 60,
  "10Y": 120,
};

export type DistributorNetSalesHyperCardData = {
  label: string;
  currentAmount: number;
  previousAmount: number;
  changePct: number;
  sipInflowMtd: number;
  redemptionsMtd: number;
  periodYear: string;
  periodMonth: string;
};

export type DistributorReportTemplate = {
  id: string;
  name: string;
  description: string;
  category: "Book" | "Incentives" | "Compliance" | "Growth";
  formats: DistributorReportFormat[];
};

export type DistributorReportExportRow = {
  id: string;
  reportName: string;
  format: DistributorReportFormat;
  generatedAt: string;
  periodLabel: string;
  fileSizeLabel: string;
};

export type DistributorBookTrendPoint = {
  month: string;
  aum: number;
  netSales: number;
  clientCount: number;
};

export type DistributorReportBookCompositionRow = {
  id: string;
  label: string;
  amount: number;
  sharePct: number;
};

export type DistributorReportAumMovementRow = {
  id: string;
  label: string;
  amount: number;
};

export type DistributorReportSipTrendPoint = {
  month: string;
  inflow: number;
  activeSips: number;
};

export type DistributorReportIncentiveTrendPoint = {
  month: string;
  earned: number;
  paid: number;
};

export type DistributorReportIncentiveCategoryRow = {
  id: string;
  label: string;
  amount: number;
  sharePct: number;
};

export type DistributorNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  kind: DistributorNotificationKind;
};

export type SalaryPayoutBreakdown = {
  basicSalary: number;
  perform: number;
  gift: number;
  takeHome: number;
  paymentPct: number;
};

export type SalaryPayoutRow = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  amount: number;
  whenLabel: string;
  status: SalaryPayoutStatus;
  breakdown: SalaryPayoutBreakdown;
};

export type DistributorScheme = {
  id: string;
  name: string;
  amc: string;
  irn: string;
  minAmount: number;
  maxAmount: number;
  category: string;
  logoMark: string;
};
