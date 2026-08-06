import type {
  AdminHierarchyBranch,
  AdminHierarchyManager,
  AdminHierarchyPartner,
  AdminHierarchyStateHead,
} from "@/lib/admin-distributor-hierarchy-api";
import type {
  DistributorHeadDistributor,
  DistributorHeadManager,
} from "@/lib/dummy/distributor-head-data";

export function mapHierarchyManager(row: AdminHierarchyManager): DistributorHeadManager {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    city: row.city,
    branchIds: row.branch_ids,
    distributorCount: row.partner_count,
    salesMtdInr: row.sales_mtd_inr,
    salesYtdInr: row.sales_ytd_inr,
    status: row.status,
  };
}

export function mapHierarchyPartner(row: AdminHierarchyPartner): DistributorHeadDistributor {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    arn: row.arn,
    managerId: row.manager_id ?? "",
    managerName: row.manager_name ?? "—",
    branchId: row.branch_id ?? "",
    branchName: row.branch_name || "—",
    clientCount: row.client_count,
    aumInr: row.aum_inr,
    salesMtdInr: row.sales_mtd_inr,
    status: row.status,
    euin: row.euin,
  };
}

export function matchesHierarchyManagerSearch(row: AdminHierarchyManager, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    row.name.toLowerCase().includes(normalized) ||
    row.email.toLowerCase().includes(normalized) ||
    row.city.toLowerCase().includes(normalized) ||
    row.branch_names.some((name) => name.toLowerCase().includes(normalized))
  );
}

export function matchesHierarchyPartnerSearch(row: AdminHierarchyPartner, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    row.name.toLowerCase().includes(normalized) ||
    row.email.toLowerCase().includes(normalized) ||
    row.arn.toLowerCase().includes(normalized) ||
    (row.manager_name ?? "").toLowerCase().includes(normalized) ||
    row.branch_name.toLowerCase().includes(normalized)
  );
}

export function matchesHierarchyStateHeadSearch(row: AdminHierarchyStateHead, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    row.name.toLowerCase().includes(normalized) ||
    row.email.toLowerCase().includes(normalized) ||
    row.state_name.toLowerCase().includes(normalized) ||
    row.state_code.toLowerCase().includes(normalized)
  );
}

export function matchesHierarchyBranchSearch(row: AdminHierarchyBranch, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    row.name.toLowerCase().includes(normalized) ||
    (row.city ?? "").toLowerCase().includes(normalized) ||
    row.manager_name.toLowerCase().includes(normalized) ||
    row.manager_email.toLowerCase().includes(normalized) ||
    row.state_name.toLowerCase().includes(normalized) ||
    row.state_code.toLowerCase().includes(normalized)
  );
}
