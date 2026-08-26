import { apiRequest } from "@/lib/api-client";
import { pickUserRef, userRefToPath } from "@/lib/admin-user-ref";

function hierarchyUserRefPath(userRef: string) {
  return encodeURIComponent(userRefToPath(pickUserRef({ client_id: userRef, user_id: userRef })));
}

export type AdminHierarchyOverview = {
  state_code: string;
  state_name: string;
  state_assigned: boolean;
  manager_count: number;
  partner_count: number;
  active_partner_count: number;
  branch_count: number;
  pending_review_count: number;
  pending_branch_count: number;
  sales_mtd_inr: number;
};

export type AdminHierarchyBranchStatus = "pending_approval" | "active" | "rejected";

export type AdminHierarchyBranch = {
  id: string;
  branch_code: string | null;
  name: string;
  city: string | null;
  state_code: string;
  state_name: string;
  status: AdminHierarchyBranchStatus;
  status_label: string;
  manager_id: string | null;
  manager_name: string | null;
  manager_email: string | null;
  manager_status: string | null;
  manager_unavailable: boolean;
  created_by_user_id: string | null;
  rejection_reason: string | null;
  partner_count: number;
  active_partner_count?: number;
  active_clients: number;
  aum_inr: number;
  sales_mtd_inr: number;
};

export type AdminHierarchyBranchDetail = AdminHierarchyBranch & {
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  created_by_name: string | null;
  created_by_email: string | null;
  approved_by_name: string | null;
  approved_by_email: string | null;
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
  client_id: string;
  user_ref: string;
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
  client_id: string;
  user_ref: string;
  name: string;
  email: string;
};

export type CreateAdminBranchPayload = {
  name: string;
  city?: string;
  state_code: string;
  state_name: string;
  manager_user_ref?: string;
};

export type AdminHierarchyStateHead = {
  user_id: string;
  client_id: string;
  user_ref: string;
  name: string;
  email: string;
  state_code: string;
  state_name: string;
  status?: "active" | "paused";
  manager_count?: number;
  branch_count?: number;
  pending_branch_count?: number;
  unassigned_branch_count?: number;
  partner_count?: number;
  active_partner_count?: number;
  client_count?: number;
  aum_inr?: number;
  sales_mtd_inr?: number;
};

export type AdminHierarchyUnassignedState = {
  state_code: string;
  state_name: string;
  branch_count: number;
  message: string;
};

export type AdminHierarchyStateHeadCandidate = {
  user_id: string;
  client_id: string;
  user_ref: string;
  name: string;
  email: string;
};

export type CreateAdminStateHeadPayload = {
  user_ref: string;
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

export async function fetchAdminHierarchyBranch(branchId: string) {
  const result = await apiRequest<{ branch: AdminHierarchyBranchDetail }>(
    `/admin/distributor-hierarchy/branches/${encodeURIComponent(branchId)}`,
  );
  return result.branch;
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
  const body = {
    ...payload,
    manager_user_ref: payload.manager_user_ref
      ? userRefToPath(
          pickUserRef({ client_id: payload.manager_user_ref, user_id: payload.manager_user_ref }),
        )
      : undefined,
  };
  return apiRequest<{ branch: AdminHierarchyBranch }>("/admin/distributor-hierarchy/branches", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function approveAdminHierarchyBranch(branchId: string) {
  return apiRequest<{ branch: AdminHierarchyBranch }>(
    `/admin/distributor-hierarchy/branches/${encodeURIComponent(branchId)}/approve`,
    { method: "POST" },
  );
}

export async function rejectAdminHierarchyBranch(branchId: string, reason?: string) {
  return apiRequest<{ branch: AdminHierarchyBranch }>(
    `/admin/distributor-hierarchy/branches/${encodeURIComponent(branchId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason: reason?.trim() || undefined }),
    },
  );
}

export async function assignAdminHierarchyBranchManager(
  branchId: string,
  managerUserRef: string,
  options?: { replaceExisting?: boolean },
) {
  return apiRequest<{ branch: AdminHierarchyBranch }>(
    `/admin/distributor-hierarchy/branches/${encodeURIComponent(branchId)}/assign-manager`,
    {
      method: "POST",
      body: JSON.stringify({
        manager_user_ref: userRefToPath(pickUserRef({ client_id: managerUserRef, user_id: managerUserRef })),
        replace_existing: options?.replaceExisting ?? false,
      }),
    },
  );
}

export async function unassignAdminHierarchyBranchManager(branchId: string) {
  return apiRequest<{ branch: AdminHierarchyBranch }>(
    `/admin/distributor-hierarchy/branches/${encodeURIComponent(branchId)}/unassign-manager`,
    { method: "POST" },
  );
}

export type UpdateAdminBranchPayload = {
  name?: string;
  city?: string;
};

export async function updateAdminHierarchyBranch(branchId: string, payload: UpdateAdminBranchPayload) {
  return apiRequest<{ branch: AdminHierarchyBranchDetail }>(
    `/admin/distributor-hierarchy/branches/${encodeURIComponent(branchId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export type InviteAdminMitraManagerPayload = {
  email: string;
  first_name?: string;
  last_name?: string;
};

export type AdminHierarchyMitraManagerInvitation = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_key: string;
  role_name: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  invited_by: string | null;
  inviter_name: string | null;
  accepted_user_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchAdminHierarchyMitraManagerInvitations() {
  const result = await apiRequest<{ items: AdminHierarchyMitraManagerInvitation[] }>(
    "/admin/distributor-hierarchy/mitra-manager-invitations",
  );
  return result.items;
}

export async function revokeAdminHierarchyMitraManagerInvitation(invitationId: string) {
  return apiRequest<{ invitation: AdminHierarchyMitraManagerInvitation }>(
    `/admin/distributor-hierarchy/mitra-manager-invitations/${encodeURIComponent(invitationId)}/revoke`,
    { method: "POST" },
  );
}

export async function resendAdminHierarchyMitraManagerInvitation(invitationId: string) {
  return apiRequest<{ invitation: AdminHierarchyMitraManagerInvitation }>(
    `/admin/distributor-hierarchy/mitra-manager-invitations/${encodeURIComponent(invitationId)}/resend`,
    { method: "POST" },
  );
}

export async function inviteAdminHierarchyMitraManager(payload: InviteAdminMitraManagerPayload) {
  return apiRequest<{ invitation: AdminHierarchyMitraManagerInvitation }>(
    "/admin/distributor-hierarchy/mitra-manager-invitations",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchAdminHierarchyStateHeadCandidates() {
  const result = await apiRequest<{ items: AdminHierarchyStateHeadCandidate[] }>(
    "/admin/distributor-hierarchy/state-head-candidates",
  );
  return result.items;
}

export async function fetchAdminHierarchyUnassignedStates() {
  const result = await apiRequest<{ items: AdminHierarchyUnassignedState[] }>(
    "/admin/distributor-hierarchy/unassigned-states",
  );
  return result.items;
}

export async function createAdminHierarchyStateHead(payload: CreateAdminStateHeadPayload) {
  return apiRequest<{ state_head: AdminHierarchyStateHead }>(
    "/admin/distributor-hierarchy/state-heads",
    {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        user_ref: userRefToPath(
          pickUserRef({ client_id: payload.user_ref, user_id: payload.user_ref }),
        ),
      }),
    },
  );
}

export async function pauseAdminHierarchyStateHead(userRef: string) {
  return apiRequest<{ state_head: AdminHierarchyStateHead }>(
    `/admin/distributor-hierarchy/state-heads/${hierarchyUserRefPath(userRef)}/pause`,
    { method: "POST" },
  );
}

export async function resumeAdminHierarchyStateHead(userRef: string) {
  return apiRequest<{ state_head: AdminHierarchyStateHead }>(
    `/admin/distributor-hierarchy/state-heads/${hierarchyUserRefPath(userRef)}/resume`,
    { method: "POST" },
  );
}

export async function replaceAdminHierarchyStateHead(userRef: string, replacementUserRef: string) {
  return apiRequest<{ previous_user_id: string; state_head: AdminHierarchyStateHead }>(
    `/admin/distributor-hierarchy/state-heads/${hierarchyUserRefPath(userRef)}/replace`,
    {
      method: "POST",
      body: JSON.stringify({
        replacement_user_ref: userRefToPath(
          pickUserRef({
            client_id: replacementUserRef,
            user_id: replacementUserRef,
          }),
        ),
      }),
    },
  );
}

export async function unassignAdminHierarchyStateHead(userRef: string) {
  return apiRequest<{
    result: {
      user_id: string;
      state_code: string;
      state_name: string;
      status: string;
      unassigned: boolean;
      message: string;
    };
  }>(`/admin/distributor-hierarchy/state-heads/${hierarchyUserRefPath(userRef)}`, {
    method: "DELETE",
  });
}
