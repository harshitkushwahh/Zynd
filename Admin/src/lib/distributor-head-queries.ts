import {
  DUMMY_BRANCHES,
  DUMMY_DISTRIBUTORS,
  DUMMY_LEAVE_APPLICATIONS,
  DUMMY_MANAGER_CLIENTS,
  DUMMY_MANAGER_INCENTIVES,
  DUMMY_MANAGERS,
  type DistributorHeadBranch,
  type DistributorHeadDistributor,
  type DistributorHeadManager,
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
