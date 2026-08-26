import type { BranchDistributorProfile, BranchDistributorWorkSnapshot } from "@/lib/distributor-domain-types";
import type { DistributorReportTemplate } from "@/lib/distributor-reports-data";
import type { BranchDistributorCommissionRow, BranchCommissionHoldEntry } from "@/lib/distributor-domain-types";
import type {
  BranchAumSalesRollup,
  BranchComplianceException,
  BranchKycPendingRow,
  BranchReportRollupPeriod,
  BranchReportTrendPoint,
} from "@/lib/distributor-domain-types";
import type { DistributorComplianceQueueRow } from "@/lib/distributor-compliance-data";
import {
  DUMMY_DISTRIBUTOR_JOB_COMPENSATION,
  DUMMY_DISTRIBUTOR_JOB_PERFORMANCE,
  DUMMY_DISTRIBUTOR_JOB_WORK_HOURS,
  DUMMY_DISTRIBUTOR_LEAVE_BALANCES,
  DUMMY_DISTRIBUTOR_LEAVE_REQUESTS,
  DUMMY_DISTRIBUTOR_WORK_ATTENDANCE,
} from "@/lib/distributor-job-dashboard-data";

export const BRANCH_DISTRIBUTOR_REPORT_TEMPLATES: DistributorReportTemplate[] = [];

export function getBranchDistributorReportTemplates(
  _profile: BranchDistributorProfile,
): DistributorReportTemplate[] {
  return [];
}

export function getBranchReportRollupForDistributor(
  _profile: BranchDistributorProfile,
  _period: BranchReportRollupPeriod,
): BranchAumSalesRollup[] {
  return [];
}

export function getBranchReportTrendForDistributor(
  _profile: BranchDistributorProfile,
): BranchReportTrendPoint[] {
  return [];
}

export function getBranchKycPendingForDistributor(
  _profile: BranchDistributorProfile,
): BranchKycPendingRow[] {
  return [];
}

export function getBranchComplianceExceptionsForDistributor(
  _profile: BranchDistributorProfile,
): BranchComplianceException[] {
  return [];
}

export function getComplianceQueueForBranchDistributor(
  _profile: BranchDistributorProfile,
): DistributorComplianceQueueRow[] {
  return [];
}

export function getBranchCommissionRowForDistributor(
  _profile: BranchDistributorProfile,
): BranchDistributorCommissionRow | undefined {
  return undefined;
}

export function getBranchCommissionHoldsForDistributor(
  _profile: BranchDistributorProfile,
): BranchCommissionHoldEntry[] {
  return [];
}

export function getBranchDistributorWorkSnapshot(
  _profile: BranchDistributorProfile,
): BranchDistributorWorkSnapshot {
  return {
    compensation: DUMMY_DISTRIBUTOR_JOB_COMPENSATION,
    performance: DUMMY_DISTRIBUTOR_JOB_PERFORMANCE,
    leaveBalances: DUMMY_DISTRIBUTOR_LEAVE_BALANCES,
    leaveRequests: DUMMY_DISTRIBUTOR_LEAVE_REQUESTS,
    attendanceRows: DUMMY_DISTRIBUTOR_WORK_ATTENDANCE,
    workHours: DUMMY_DISTRIBUTOR_JOB_WORK_HOURS,
    commissionRow: undefined,
    commissionHolds: [],
  };
}

export function getBranchDistributorWorkSummary(_snapshot: BranchDistributorWorkSnapshot) {
  return {
    activeLeaveDays: 0,
    pendingLeaveRequests: 0,
    attendancePct: 0,
    netCommission: 0,
  };
}

export type { BranchDistributorWorkSnapshot } from "@/lib/distributor-domain-types";
