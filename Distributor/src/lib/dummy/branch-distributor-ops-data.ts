import type { DistributorReportTemplate } from "@/lib/dummy/distributor-reports";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import {
  getBranchCommissionDistributorRows,
  DUMMY_BRANCH_COMMISSION_HOLDS,
  type BranchCommissionHoldEntry,
  type BranchCommissionPeriod,
  type BranchDistributorCommissionRow,
} from "@/lib/dummy/branch-commissions";
import type { BranchDistributorProfile } from "@/lib/dummy/branch-distributor-profile";
import {
  DUMMY_BRANCH_AUM_SALES_ROLLUP,
  DUMMY_BRANCH_COMPLIANCE_EXCEPTIONS,
  DUMMY_BRANCH_KYC_PENDING,
  DUMMY_BRANCH_REPORT_TREND,
  type BranchAumSalesRollup,
  type BranchComplianceException,
  type BranchKycPendingRow,
  type BranchReportTrendPoint,
} from "@/lib/dummy/branch-reports";
import {
  DUMMY_DISTRIBUTOR_COMPLIANCE_QUEUE,
  type DistributorComplianceQueueRow,
} from "@/lib/dummy/distributor-compliance";
import {
  DUMMY_DISTRIBUTOR_JOB_COMPENSATION,
  DUMMY_DISTRIBUTOR_JOB_PERFORMANCE,
  DUMMY_DISTRIBUTOR_JOB_WORK_HOURS,
  DUMMY_DISTRIBUTOR_LEAVE_BALANCES,
  DUMMY_DISTRIBUTOR_LEAVE_REQUESTS,
  DUMMY_DISTRIBUTOR_WORK_ATTENDANCE,
  getDistributorJobCompensationSummary,
  getDistributorWorkAttendanceSummary,
  type DistributorJobCompensation,
  type DistributorJobPerformanceCalc,
  type DistributorJobWorkHours,
  type DistributorLeaveBalance,
  type DistributorLeaveRequest,
  type DistributorWorkAttendanceRow,
} from "@/lib/dummy/distributor-job-dashboard";

const WORK_SCALE: Record<string, number> = {
  "bd-1": 1.18,
  "bd-2": 1,
  "bd-3": 0.42,
};

export const BRANCH_DISTRIBUTOR_REPORT_TEMPLATES: DistributorReportTemplate[] = [
  {
    id: "bd-rt-aum",
    name: "AUM & net sales",
    description: "Book AUM, SIP inflow, redemptions, and net sales for the selected period.",
    category: "Book",
    formats: ["PDF", "Excel"],
  },
  {
    id: "bd-rt-holdings",
    name: "Holdings statement",
    description: ZYND_MITRA_COPY.holdingsAcrossBook,
    category: "Book",
    formats: ["PDF", "Excel"],
  },
  {
    id: "bd-rt-sip",
    name: "SIP book",
    description: "Active SIPs, instalment amounts, and upcoming debit dates.",
    category: "Book",
    formats: ["PDF", "Excel"],
  },
  {
    id: "bd-rt-growth",
    name: "Client growth",
    description: ZYND_MITRA_COPY.onboardingsInBook,
    category: "Growth",
    formats: ["PDF", "Excel"],
  },
  {
    id: "bd-rt-kyc",
    name: "KYC pending pack",
    description: "Open onboarding cases with stage, age, and client contact details.",
    category: "Compliance",
    formats: ["PDF", "Excel"],
  },
  {
    id: "bd-rt-compliance",
    name: "Compliance exceptions",
    description: "Open and in-review exceptions with severity for branch follow-up.",
    category: "Compliance",
    formats: ["PDF", "Excel"],
  },
];

export function getBranchDistributorReportTemplates(
  _distributorId: string,
): DistributorReportTemplate[] {
  return BRANCH_DISTRIBUTOR_REPORT_TEMPLATES;
}

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

function scaleAmount(value: number, factor: number): number {
  return Math.round(value * factor);
}

export function getBranchReportRollupForDistributor(
  distributorId: string,
): BranchAumSalesRollup | undefined {
  return DUMMY_BRANCH_AUM_SALES_ROLLUP.find((row) => row.distributorId === distributorId);
}

export function getBranchReportTrendForDistributor(
  distributorId: string,
): BranchReportTrendPoint[] {
  const rollup = getBranchReportRollupForDistributor(distributorId);
  if (!rollup) return [];

  const branchAum = DUMMY_BRANCH_AUM_SALES_ROLLUP.reduce((sum, row) => sum + row.aum, 0);
  const share = branchAum > 0 ? rollup.aum / branchAum : 1 / DUMMY_BRANCH_AUM_SALES_ROLLUP.length;

  return DUMMY_BRANCH_REPORT_TREND.map((point) => ({
    month: point.month,
    aum: Math.round(point.aum * share),
    netSales: Math.round(point.netSales * share),
  }));
}

export function getBranchKycPendingForDistributor(
  profile: BranchDistributorProfile,
): BranchKycPendingRow[] {
  return DUMMY_BRANCH_KYC_PENDING.filter((row) => row.distributorName === profile.name);
}

export function getBranchComplianceExceptionsForDistributor(
  profile: BranchDistributorProfile,
): BranchComplianceException[] {
  return DUMMY_BRANCH_COMPLIANCE_EXCEPTIONS.filter((row) => row.distributorName === profile.name);
}

export function getComplianceQueueForBranchDistributor(
  profile: BranchDistributorProfile,
): DistributorComplianceQueueRow[] {
  const clientIds = new Set(profile.featuredInvestorIds);
  const fromQueue = DUMMY_DISTRIBUTOR_COMPLIANCE_QUEUE.filter((row) => clientIds.has(row.clientId));
  if (fromQueue.length > 0) return fromQueue;

  return DUMMY_DISTRIBUTOR_COMPLIANCE_QUEUE.filter((_, index) => {
    const bucket = profile.id.charCodeAt(profile.id.length - 1) % 3;
    return index % 3 === bucket;
  });
}

export function getBranchCommissionRowForDistributor(
  distributorId: string,
  period: BranchCommissionPeriod = "mtd",
): BranchDistributorCommissionRow | undefined {
  return getBranchCommissionDistributorRows(period).find((row) => row.distributorId === distributorId);
}

export function getBranchCommissionHoldsForDistributor(
  distributorId: string,
): BranchCommissionHoldEntry[] {
  return DUMMY_BRANCH_COMMISSION_HOLDS.filter((row) => row.distributorId === distributorId);
}

export function getBranchDistributorWorkSnapshot(
  distributorId: string,
): BranchDistributorWorkSnapshot {
  const factor = WORK_SCALE[distributorId] ?? 1;
  const base = DUMMY_DISTRIBUTOR_JOB_COMPENSATION;
  const perf = DUMMY_DISTRIBUTOR_JOB_PERFORMANCE;

  const compensation: DistributorJobCompensation = {
    ...base,
    basicSalary: scaleAmount(base.basicSalary, factor),
    performanceIncentive: scaleAmount(base.performanceIncentive, factor),
    spotBonus: scaleAmount(base.spotBonus, factor),
    takeHome: scaleAmount(base.takeHome, factor),
  };

  const performance: DistributorJobPerformanceCalc = {
    ...perf,
    netSalesTarget: scaleAmount(perf.netSalesTarget, factor),
    netSalesAchieved: scaleAmount(perf.netSalesAchieved, factor),
    incentiveSlab: scaleAmount(perf.incentiveSlab, factor),
    calculatedIncentive: scaleAmount(perf.calculatedIncentive, factor),
    finalIncentive: scaleAmount(perf.finalIncentive, factor),
  };

  const workHours: DistributorJobWorkHours = {
    ...DUMMY_DISTRIBUTOR_JOB_WORK_HOURS,
    totalHours: Math.round(DUMMY_DISTRIBUTOR_JOB_WORK_HOURS.totalHours * (0.92 + factor * 0.08)),
    overtimeHours: Math.round(DUMMY_DISTRIBUTOR_JOB_WORK_HOURS.overtimeHours * factor * 10) / 10,
  };

  return {
    compensation,
    performance,
    leaveBalances: DUMMY_DISTRIBUTOR_LEAVE_BALANCES,
    leaveRequests: DUMMY_DISTRIBUTOR_LEAVE_REQUESTS,
    attendanceRows: DUMMY_DISTRIBUTOR_WORK_ATTENDANCE,
    workHours,
    commissionRow: getBranchCommissionRowForDistributor(distributorId),
    commissionHolds: getBranchCommissionHoldsForDistributor(distributorId),
  };
}

export function getBranchDistributorWorkSummary(snapshot: BranchDistributorWorkSnapshot) {
  const compensation = getDistributorJobCompensationSummary(snapshot.compensation);
  const attendance = getDistributorWorkAttendanceSummary(snapshot.attendanceRows);
  const pendingLeave = snapshot.leaveRequests.filter((row) => row.status === "Pending").length;

  return {
    ...compensation,
    ...attendance,
    pendingLeave,
  };
}
