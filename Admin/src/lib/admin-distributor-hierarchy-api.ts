import { apiRequest } from "@/lib/api-client";

export type AdminHierarchyOverview = {
  state_code: string;
  state_name: string;
  manager_count: number;
  partner_count: number;
  active_partner_count: number;
  branch_count: number;
  pending_review_count: number;
  sales_mtd_inr: number;
};

export type AdminHierarchyBranch = {
  id: string;
  name: string;
  city: string | null;
  state_code: string;
  state_name: string;
  manager_id: string;
  manager_name: string;
  manager_email: string;
  partner_count: number;
  active_clients: number;
  aum_inr: number;
  sales_mtd_inr: number;
};

export type AdminHierarchyManager = {
  id: string;
  name: string;
  email: string;
  city: string;
  branch_ids: string[];
  branch_names: string[];
  state_code: string;
  state_name: string;
  partner_count: number;
  sales_mtd_inr: number;
  sales_ytd_inr: number;
  status: "Active" | "On leave";
};

export type AdminHierarchyPartner = {
  id: string;
  partner_id: string;
  user_id: string;
  name: string;
  email: string;
  arn: string;
  euin: string;
  manager_id: string | null;
  manager_name: string | null;
  branch_id: string | null;
  branch_name: string;
  client_count: number;
  aum_inr: number;
  sales_mtd_inr: number;
  status: "Active" | "Onboarding" | "Suspended";
  onboarding_status: string;
};

export type AdminHierarchyBranchManagerCandidate = {
  user_id: string;
  name: string;
  email: string;
};

export type CreateAdminBranchPayload = {
  name: string;
  city?: string;
  state_code: string;
  state_name: string;
  manager_user_id: string;
};

export type AdminHierarchyStateHead = {
  user_id: string;
  name: string;
  email: string;
  state_code: string;
  state_name: string;
};

export type AdminHierarchyStateHeadCandidate = {
  user_id: string;
  name: string;
  email: string;
};

export type CreateAdminStateHeadPayload = {
  user_id: string;
  state_code: string;
  state_name: string;
};

export async function fetchAdminHierarchyOverview() {
  const result = await apiRequest<{ overview: AdminHierarchyOverview }>(
    "/admin/distributor-hierarchy/overview",
  );
  return result.overview;
}

export async function fetchAdminHierarchyBranches() {
  const result = await apiRequest<{ items: AdminHierarchyBranch[] }>(
    "/admin/distributor-hierarchy/branches",
  );
  return result.items;
}

export async function fetchAdminHierarchyManagers() {
  const result = await apiRequest<{ items: AdminHierarchyManager[] }>(
    "/admin/distributor-hierarchy/managers",
  );
  return result.items;
}

export async function fetchAdminHierarchyPartners() {
  const result = await apiRequest<{ items: AdminHierarchyPartner[] }>(
    "/admin/distributor-hierarchy/partners",
  );
  return result.items;
}

export async function fetchAdminHierarchyStateHeads() {
  const result = await apiRequest<{ items: AdminHierarchyStateHead[] }>(
    "/admin/distributor-hierarchy/state-heads",
  );
  return result.items;
}

export async function fetchAdminHierarchyBranchManagerCandidates() {
  const result = await apiRequest<{ items: AdminHierarchyBranchManagerCandidate[] }>(
    "/admin/distributor-hierarchy/branch-manager-candidates",
  );
  return result.items;
}

export async function createAdminHierarchyBranch(payload: CreateAdminBranchPayload) {
  return apiRequest<{ branch: AdminHierarchyBranch }>("/admin/distributor-hierarchy/branches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminHierarchyStateHeadCandidates() {
  const result = await apiRequest<{ items: AdminHierarchyStateHeadCandidate[] }>(
    "/admin/distributor-hierarchy/state-head-candidates",
  );
  return result.items;
}

export async function createAdminHierarchyStateHead(payload: CreateAdminStateHeadPayload) {
  return apiRequest<{ state_head: AdminHierarchyStateHead }>(
    "/admin/distributor-hierarchy/state-heads",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
