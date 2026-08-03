import {
  DUMMY_BRANCHES,
  DUMMY_DISTRIBUTORS,
  DUMMY_DISTRIBUTOR_AUM_TREND,
  DUMMY_DISTRIBUTOR_BOOK_HOLDINGS,
  DUMMY_DISTRIBUTOR_REPORT_ROLLUPS,
  DUMMY_DISTRIBUTOR_WORK_ATTENDANCE,
  DUMMY_DISTRIBUTOR_WORK_HOURS,
  DUMMY_LEAVE_APPLICATIONS,
  DUMMY_MANAGER_AUDIT_LOGS,
  DUMMY_MANAGER_BOOK_PURCHASES,
  DUMMY_MANAGER_BOOK_SIPS,
  DUMMY_MANAGER_CLIENTS,
  DUMMY_MANAGER_INCENTIVES,
  DUMMY_MANAGERS,
  type DistributorHeadBranch,
  type DistributorHeadBookPurchase,
  type DistributorHeadBookSipPlan,
  type DistributorHeadDistributor,
  type DistributorHeadManager,
  type DistributorHeadManagerAuditLog,
  type DistributorHeadBookHolding,
  type DistributorHeadDistributorReportRollup,
  type DistributorHeadWorkAttendanceRow,
  type DistributorHeadWorkHours,
  type DistributorHeadAumTrendPoint,
  type DistributorHeadManagerClient,
} from "@/lib/dummy/distributor-head-data";
import { DISTRIBUTOR_HEAD_TAB_IDS, type DistributorHeadTabId } from "@/lib/admin-distributor-head-navigation";

export function isDistributorHeadTabId(value: string | undefined): value is DistributorHeadTabId {
  if (!value) return false;
  return (DISTRIBUTOR_HEAD_TAB_IDS as readonly string[]).includes(value);
}

export function getDistributorHeadManager(managerId: string): DistributorHeadManager | undefined {
  return DUMMY_MANAGERS.find((row) => row.id === managerId);
}

export function getDistributorHeadDistributor(
  distributorId: string,
): DistributorHeadDistributor | undefined {
  return DUMMY_DISTRIBUTORS.find((row) => row.id === distributorId);
}

export function getBranchesForManager(managerId: string): DistributorHeadBranch[] {
  return DUMMY_BRANCHES.filter((branch) => branch.managerId === managerId);
}

export function getDistributorsForManager(managerId: string): DistributorHeadDistributor[] {
  return DUMMY_DISTRIBUTORS.filter((row) => row.managerId === managerId);
}

export function sumDistributorClients(rows: DistributorHeadDistributor[]) {
  return rows.reduce((sum, row) => sum + row.clientCount, 0);
}

export function sumDistributorAum(rows: DistributorHeadDistributor[]) {
  return rows.reduce((sum, row) => sum + row.aumInr, 0);
}

export function sumDistributorSalesMtd(rows: DistributorHeadDistributor[]) {
  return rows.reduce((sum, row) => sum + row.salesMtdInr, 0);
}

export function getClientsForManager(managerId: string) {
  return DUMMY_MANAGER_CLIENTS.filter((row) => row.managerId === managerId);
}

export function getIncentiveForManager(managerId: string) {
  return DUMMY_MANAGER_INCENTIVES.find((row) => row.managerId === managerId);
}

export function getLeaveForManager(managerId: string) {
  const team = getDistributorsForManager(managerId);
  const teamNames = new Set(team.map((row) => row.name));
  const manager = getDistributorHeadManager(managerId);
  return DUMMY_LEAVE_APPLICATIONS.filter((leave) => {
    if (manager && leave.applicantName === manager.name && leave.applicantRole === "Manager") {
      return true;
    }
    if (leave.applicantRole === "Distributor" && teamNames.has(leave.applicantName)) {
      return true;
    }
    return false;
  });
}

/** State head inbox: manager leave only — distributor requests are approved by their manager. */
export function getLeaveForStateHead() {
  return DUMMY_LEAVE_APPLICATIONS.filter((leave) => leave.applicantRole === "Manager");
}

export function getManagerOwnLeave(managerId: string) {
  const manager = getDistributorHeadManager(managerId);
  if (!manager) return [];
  return DUMMY_LEAVE_APPLICATIONS.filter(
    (leave) => leave.applicantName === manager.name && leave.applicantRole === "Manager",
  );
}

export function getTeamLeaveForManager(managerId: string) {
  const team = getDistributorsForManager(managerId);
  const teamNames = new Set(team.map((row) => row.name));
  return DUMMY_LEAVE_APPLICATIONS.filter(
    (leave) => leave.applicantRole === "Distributor" && teamNames.has(leave.applicantName),
  );
}

export function getSipPlansForManager(managerId: string): DistributorHeadBookSipPlan[] {
  return DUMMY_MANAGER_BOOK_SIPS.filter((row) => row.managerId === managerId);
}

export function getPurchasesForManager(managerId: string): DistributorHeadBookPurchase[] {
  return DUMMY_MANAGER_BOOK_PURCHASES.filter((row) => row.managerId === managerId);
}

export function getAuditLogsForManager(managerId: string): DistributorHeadManagerAuditLog[] {
  return DUMMY_MANAGER_AUDIT_LOGS.filter((row) => row.managerId === managerId);
}

export type ManagerBookSummary = {
  totalAumInr: number;
  totalClients: number;
  activeSipCount: number;
  sipCommitmentMonthlyInr: number;
  lumpsumMtdInr: number;
  sipMtdInr: number;
  salesMtdInr: number;
};

export function getManagerBookSummary(managerId: string): ManagerBookSummary {
  const team = getDistributorsForManager(managerId);
  const clients = getClientsForManager(managerId);
  const sips = getSipPlansForManager(managerId);
  const purchases = getPurchasesForManager(managerId);
  const activeSips = sips.filter((row) => row.status === "active");

  const lumpsumMtdInr = purchases
    .filter((row) => row.status === "completed")
    .reduce((sum, row) => sum + row.amountInr, 0);
  const sipMtdInr = activeSips.reduce((sum, row) => sum + row.amountInr, 0);

  return {
    totalAumInr: sumDistributorAum(team),
    totalClients: clients.length > 0 ? clients.length : sumDistributorClients(team),
    activeSipCount: activeSips.length,
    sipCommitmentMonthlyInr: activeSips.reduce((sum, row) => sum + row.amountInr, 0),
    lumpsumMtdInr,
    sipMtdInr,
    salesMtdInr: sumDistributorSalesMtd(team),
  };
}

export function matchesManagerAuditSearch(row: DistributorHeadManagerAuditLog, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [row.actorName, row.eventType, row.summary, row.actorType]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function matchesManagerClientSearch(row: DistributorHeadManagerClient, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    row.name.toLowerCase().includes(normalized) ||
    row.email.toLowerCase().includes(normalized) ||
    row.distributorName.toLowerCase().includes(normalized) ||
    row.branchName.toLowerCase().includes(normalized)
  );
}

export function matchesManagerSearch(row: DistributorHeadManager, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    row.name.toLowerCase().includes(normalized) ||
    row.email.toLowerCase().includes(normalized) ||
    row.city.toLowerCase().includes(normalized)
  );
}

export function matchesDistributorSearch(row: DistributorHeadDistributor, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    row.name.toLowerCase().includes(normalized) ||
    row.email.toLowerCase().includes(normalized) ||
    row.arn.toLowerCase().includes(normalized) ||
    row.managerName.toLowerCase().includes(normalized) ||
    row.branchName.toLowerCase().includes(normalized)
  );
}

export function distributorHeadManagerHref(managerId: string) {
  return `/dashboard/distributor-head/managers/${managerId}`;
}

export function distributorHeadDistributorHref(distributorId: string) {
  return `/dashboard/distributor-head/distributors/${distributorId}`;
}

export function getClientsForDistributor(distributorId: string) {
  return DUMMY_MANAGER_CLIENTS.filter((row) => row.distributorId === distributorId);
}

export function getSipPlansForDistributor(distributorId: string): DistributorHeadBookSipPlan[] {
  return DUMMY_MANAGER_BOOK_SIPS.filter((row) => row.distributorId === distributorId);
}

export function getPurchasesForDistributor(distributorId: string): DistributorHeadBookPurchase[] {
  return DUMMY_MANAGER_BOOK_PURCHASES.filter((row) => row.distributorId === distributorId);
}

export function getAuditLogsForDistributor(distributorId: string): DistributorHeadManagerAuditLog[] {
  const distributor = getDistributorHeadDistributor(distributorId);
  return DUMMY_MANAGER_AUDIT_LOGS.filter((row) => {
    if (row.distributorId === distributorId) return true;
    if (distributor && row.actorName === distributor.name && row.actorType === "distributor") {
      return true;
    }
    return false;
  });
}

export function getLeaveForDistributor(distributorId: string) {
  const distributor = getDistributorHeadDistributor(distributorId);
  if (!distributor) return [];
  return DUMMY_LEAVE_APPLICATIONS.filter(
    (leave) =>
      leave.applicantRole === "Distributor" && leave.applicantName === distributor.name,
  );
}

export function getAumTrendForDistributor(distributorId: string): DistributorHeadAumTrendPoint[] {
  const preset = DUMMY_DISTRIBUTOR_AUM_TREND[distributorId];
  if (preset) return preset;
  const distributor = getDistributorHeadDistributor(distributorId);
  if (!distributor || distributor.aumInr <= 0) return [];
  const current = distributor.aumInr;
  return [
    { label: "Mar", aumInr: Math.round(current * 0.82) },
    { label: "Apr", aumInr: Math.round(current * 0.86) },
    { label: "May", aumInr: Math.round(current * 0.89) },
    { label: "Jun", aumInr: Math.round(current * 0.93) },
    { label: "Jul", aumInr: Math.round(current * 0.97) },
    { label: "Aug", aumInr: current },
  ];
}

export function getBookHoldingsForDistributor(distributorId: string): DistributorHeadBookHolding[] {
  return DUMMY_DISTRIBUTOR_BOOK_HOLDINGS.filter((row) => row.distributorId === distributorId);
}

export function getReportRollupForDistributor(
  distributorId: string,
): DistributorHeadDistributorReportRollup | undefined {
  const preset = DUMMY_DISTRIBUTOR_REPORT_ROLLUPS.find((row) => row.distributorId === distributorId);
  if (preset) return preset;
  const distributor = getDistributorHeadDistributor(distributorId);
  if (!distributor) return undefined;
  const sips = getSipPlansForDistributor(distributorId);
  const activeSips = sips.filter((row) => row.status === "active");
  const sipInflow = activeSips.reduce((sum, row) => sum + row.amountInr, 0);
  const clients = getClientsForDistributor(distributorId);
  return {
    distributorId,
    aumChangeMtdPct: 1.2,
    netSalesMtdInr: distributor.salesMtdInr,
    sipInflowMtdInr: sipInflow,
    redemptionsMtdInr: Math.round(distributor.salesMtdInr * 0.12),
    kycPendingCount: clients.filter((row) => !row.kycCompliant).length,
    complianceOpenCount: 0,
  };
}

export function getWorkAttendanceForDistributor(
  distributorId: string,
): DistributorHeadWorkAttendanceRow[] {
  return DUMMY_DISTRIBUTOR_WORK_ATTENDANCE.filter((row) => row.distributorId === distributorId);
}

export function getWorkHoursForDistributor(distributorId: string): DistributorHeadWorkHours | undefined {
  return DUMMY_DISTRIBUTOR_WORK_HOURS.find((row) => row.distributorId === distributorId);
}

export type DistributorBookSummary = {
  totalAumInr: number;
  totalClients: number;
  activeSipCount: number;
  sipCommitmentMonthlyInr: number;
  lumpsumMtdInr: number;
  sipMtdInr: number;
  salesMtdInr: number;
};

export function getDistributorBookSummary(distributorId: string): DistributorBookSummary {
  const distributor = getDistributorHeadDistributor(distributorId);
  const clients = getClientsForDistributor(distributorId);
  const sips = getSipPlansForDistributor(distributorId);
  const purchases = getPurchasesForDistributor(distributorId);
  const activeSips = sips.filter((row) => row.status === "active");

  const lumpsumMtdInr = purchases
    .filter((row) => row.status === "completed")
    .reduce((sum, row) => sum + row.amountInr, 0);
  const sipMtdInr = activeSips.reduce((sum, row) => sum + row.amountInr, 0);

  return {
    totalAumInr: distributor?.aumInr ?? 0,
    totalClients:
      clients.length > 0 ? clients.length : (distributor?.clientCount ?? 0),
    activeSipCount: activeSips.length || (distributor?.activeSipCount ?? 0),
    sipCommitmentMonthlyInr: activeSips.reduce((sum, row) => sum + row.amountInr, 0),
    lumpsumMtdInr,
    sipMtdInr,
    salesMtdInr: distributor?.salesMtdInr ?? lumpsumMtdInr + sipMtdInr,
  };
}

export function matchesDistributorClientSearch(row: DistributorHeadManagerClient, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    row.name.toLowerCase().includes(normalized) ||
    row.email.toLowerCase().includes(normalized) ||
    row.branchName.toLowerCase().includes(normalized)
  );
}

export function matchesDistributorAuditSearch(row: DistributorHeadManagerAuditLog, query: string) {
  return matchesManagerAuditSearch(row, query);
}
