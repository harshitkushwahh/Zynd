import { apiRequest } from "@/lib/api-client";
import { clientIdToProfilePath } from "@/lib/admin-user-ref";

function adminUserRefPath(userRef: string) {
  return clientIdToProfilePath(userRef);
}

export type SecurityReviewItem = {
  id: string;
  user_id: string;
  user_email: string;
  reason: string;
  status: string;
  metadata: Record<string, unknown>;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type PendingDeletionItem = {
  user_id: string;
  email: string;
  deletion_requested_at: string | null;
  deletion_scheduled_at: string | null;
  is_due: boolean;
};

export async function fetchSecurityReviews(status = "open") {
  const result = await apiRequest<{ items: SecurityReviewItem[] }>(
    `/admin/security-reviews?status=${encodeURIComponent(status)}`
  );
  return result.items;
}

export async function resolveSecurityReview(
  itemId: string,
  payload: { status: "reviewed" | "dismissed"; notes?: string }
) {
  return apiRequest(`/admin/security-reviews/${itemId}/resolve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchPendingDeletions() {
  const result = await apiRequest<{ items: PendingDeletionItem[] }>("/admin/deletions/pending");
  return result.items;
}

export async function runDeletionExecutor() {
  return apiRequest<{
    status: "pending";
    action_id: string;
    message: string;
  }>("/admin/deletions/run-executor", { method: "POST" });
}

export async function fetchRetentionSchedule() {
  const result = await apiRequest<{
    policies: Array<{
      data_class: string;
      min_retention_days: number;
      legal_basis: string;
      can_delete_on_request: boolean;
      notes: string | null;
    }>;
  }>("/admin/retention/schedule");
  return result.policies;
}

export async function fetchAdminRoles() {
  const result = await apiRequest<{
    roles: AdminRole[];
  }>("/admin/rbac/roles");
  return result.roles;
}

export type SecurityConfigItem = {
  key: string;
  value: unknown;
  scope: string;
  version: number;
  updated_at: string;
};

export async function fetchSecurityConfig() {
  const result = await apiRequest<{ items: SecurityConfigItem[] }>("/admin/security/config");
  return result.items;
}

export async function requestSecurityConfigUpdate(payload: {
  key: string;
  value: string | number | boolean;
  reason?: string;
}) {
  return apiRequest<{ action_id: string; message: string }>("/admin/security/config/update", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminPermissions() {
  const result = await apiRequest<{ permissions: AdminPermission[] }>("/admin/rbac/permissions");
  return result.permissions;
}

export async function createAdminPermission(payload: { key: string; description: string }) {
  return apiRequest<AdminPermission>("/admin/rbac/permissions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createAdminRole(payload: {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}) {
  return apiRequest<AdminRole>("/admin/rbac/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminRole(
  roleKey: string,
  payload: {
    name?: string;
    description?: string;
    permissions?: string[];
  },
) {
  return apiRequest<AdminRole>(`/admin/rbac/roles/${encodeURIComponent(roleKey)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminRole(roleKey: string) {
  return apiRequest<{ message: string }>(`/admin/rbac/roles/${encodeURIComponent(roleKey)}`, {
    method: "DELETE",
  });
}

export type AdminRole = {
  key: string;
  name: string;
  description: string;
  permissions: string[];
  is_system?: boolean;
};

export type AdminPermission = {
  key: string;
  description: string;
};

export type AdminUserListItem = {
  user_id: string;
  client_id: string;
  email: string;
  display_name: string;
  status: string;
  role: string;
  has_invested: boolean;
  kyc_compliant: boolean;
  suspended_at: string | null;
  mfa_enrolled: boolean;
  created_at: string;
};

export async function fetchAdminUsers(params?: {
  email?: string;
  status?: string;
  role?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.email) search.set("email", params.email);
  if (params?.status) search.set("status", params.status);
  if (params?.role) search.set("role", params.role);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const query = search.toString();
  const result = await apiRequest<{ items: AdminUserListItem[] }>(
    `/admin/users${query ? `?${query}` : ""}`,
  );
  return result.items;
}

export async function fetchAdminUserRoles(userId: string) {
  return apiRequest<{ user_id: string; roles: string[] }>(
    `/admin/rbac/users/${adminUserRefPath(userId)}/roles`,
  );
}

export async function assignAdminUserRole(userId: string, roleKey: string) {
  return apiRequest<{ user_id: string; roles: string[] }>(
    `/admin/rbac/users/${adminUserRefPath(userId)}/roles`,
    {
      method: "POST",
      body: JSON.stringify({ role_key: roleKey }),
    },
  );
}

export async function revokeAdminUserRole(userId: string, roleKey: string) {
  return apiRequest<{ user_id: string; roles: string[] }>(
    `/admin/rbac/users/${adminUserRefPath(userId)}/roles/${encodeURIComponent(roleKey)}`,
    { method: "DELETE" },
  );
}

export async function setAdminUserRoles(userId: string, roleKeys: string[]) {
  return apiRequest<{ user_id: string; roles: string[] }>(
    `/admin/rbac/users/${adminUserRefPath(userId)}/roles`,
    {
      method: "PUT",
      body: JSON.stringify({ role_keys: roleKeys }),
    },
  );
}

export type CreateAdminUserPayload = {
  email: string;
  first_name: string;
  last_name?: string;
  password: string;
  role_keys: string[];
};

export async function createAdminUser(payload: CreateAdminUserPayload) {
  return apiRequest<AdminUserListItem & { roles: string[] }>("/admin/rbac/admin-users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type AdminInvitation = {
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

export type CreateAdminInvitationPayload = {
  email: string;
  role_key: string;
  first_name?: string;
  last_name?: string;
};

export async function fetchAdminInvitations() {
  const result = await apiRequest<{ items: AdminInvitation[] }>("/admin/invitations");
  return result.items;
}

export async function createAdminInvitation(payload: CreateAdminInvitationPayload) {
  return apiRequest<AdminInvitation>("/admin/invitations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeAdminInvitation(invitationId: string) {
  return apiRequest<AdminInvitation>(`/admin/invitations/${invitationId}/revoke`, {
    method: "POST",
  });
}

export async function resendAdminInvitation(invitationId: string) {
  return apiRequest<AdminInvitation>(`/admin/invitations/${invitationId}/resend`, {
    method: "POST",
  });
}

export type AuditLogItem = {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function fetchAuditLogs(params?: {
  user_id?: string;
  event_type?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.user_id) search.set("user_id", params.user_id);
  if (params?.event_type) search.set("event_type", params.event_type);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const query = search.toString();
  const result = await apiRequest<{ items: AuditLogItem[] }>(
    `/admin/audit${query ? `?${query}` : ""}`,
  );
  return result.items;
}

export type AdminUserSummary = {
  user_id: string;
  client_id: string;
  email: string;
  display_name: string;
  status: string;
  role: string;
  has_invested: boolean;
  suspended_at: string | null;
  suspension_reason_code: string | null;
  mfa_enrolled: boolean;
  created_at: string;
};

export async function fetchAdminUserSummary(userId: string) {
  return apiRequest<AdminUserSummary>(`/admin/users/${adminUserRefPath(userId)}`);
}

export type AdminUserKycStep = {
  key: string;
  label: string;
  status?: string;
};

export type AdminUserKycPan = {
  pan_last4: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  pan_category: string | null;
};

export type AdminUserKycAddressBlock = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
};

export type AdminUserKycAddress = {
  permanent: AdminUserKycAddressBlock | null;
  correspondence: AdminUserKycAddressBlock | null;
  same_as_permanent: boolean | null;
};

export type AdminUserKycPersonal = {
  fathers_name: string | null;
  gender: string | null;
  income_slab: string | null;
  occupation: string | null;
  marital_status: string | null;
  pep_exposed: boolean | null;
  place_of_birth: string | null;
  nationality: string | null;
};

export type AdminUserKycBankDraft = {
  account_number_last4: string | null;
  ifsc_code: string | null;
  account_type: string | null;
  account_holder_name: string | null;
  bank_name: string | null;
  branch: string | null;
  readiness_verified: boolean | null;
};

export type AdminUserKycNominee = {
  full_name?: string | null;
  name?: string | null;
  relationship?: string | null;
  share_percent?: number | null;
  date_of_birth?: string | null;
  document_type?: string | null;
  document_number_last4?: string | null;
  pan_last4?: string | null;
  guardian_name?: string | null;
  guardian_pan_last4?: string | null;
  sync_status?: string | null;
};

export type AdminUserKycSignature = {
  mode: string | null;
  has_upload: boolean;
  document_id: string | null;
};

export type AdminUserInvestorAddress = {
  id: string;
  is_primary: boolean;
  nature: string;
  line1: string;
  line2: string | null;
  line3: string | null;
  city: string | null;
  state: string | null;
  postal_code: string;
  country: string;
  sync_status: string;
};

export type AdminUserKycDetail = {
  overall_status: string;
  last_completed_step: string | null;
  active_step_index: number;
  step_statuses: Record<string, string>;
  incomplete_steps: AdminUserKycStep[];
  pan: AdminUserKycPan | null;
  address: AdminUserKycAddress | null;
  investor_addresses: AdminUserInvestorAddress[];
  personal: AdminUserKycPersonal | null;
  bank_draft: AdminUserKycBankDraft | null;
  bank_accounts: Array<Record<string, unknown>>;
  nominees: AdminUserKycNominee[];
  signature: AdminUserKycSignature | null;
  signature_document_id: string | null;
  pan_verification_status: string | null;
  bank_verification_status: string | null;
  external_kyc_status: string | null;
  kyc_form_status: string | null;
  investor_profile_status: string | null;
  documents: AdminKycDocument[];
};

export type AdminUserInvestmentsDetail = {
  orders: Array<Record<string, unknown>>;
  purchases: Array<Record<string, unknown>>;
  cart: {
    items: Array<Record<string, unknown>>;
    item_count: number;
    total_amount_inr: number;
    lumpsum_item_count: number;
    sip_item_count: number;
  };
  holdings: Array<Record<string, unknown>>;
  sip_plans: Array<Record<string, unknown>>;
};

export type AdminUserProfileDetail = {
  user_id: string;
  email: string;
  kyc: AdminUserKycDetail | null;
  investments: AdminUserInvestmentsDetail | null;
};

export async function fetchAdminUserProfileDetail(userId: string) {
  return apiRequest<AdminUserProfileDetail>(
    `/admin/users/${adminUserRefPath(userId)}/profile-detail`,
  );
}

export async function suspendAdminUser(
  userId: string,
  payload: {
    reason_code:
      | "suspicious_activity"
      | "kyc_mismatch"
      | "user_requested"
      | "compliance_hold"
      | "repeated_auth_failures"
      | "chargeback_dispute";
    notes?: string;
  }
) {
  return apiRequest<{
    status: "pending";
    action_id: string;
    message: string;
  }>(`/admin/users/${adminUserRefPath(userId)}/suspend`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function unsuspendAdminUser(userId: string) {
  return apiRequest<{
    status: "pending";
    action_id: string;
    message: string;
  }>(`/admin/users/${adminUserRefPath(userId)}/unsuspend`, {
    method: "POST",
  });
}

export type AdminActionItem = {
  id: string;
  action_type: string;
  status: string;
  target_type: string | null;
  target_id: string | null;
  target_email: string | null;
  payload: Record<string, unknown>;
  reason: string | null;
  requested_by: string;
  requested_by_email: string | null;
  approved_by: string | null;
  approved_by_email: string | null;
  rejection_notes: string | null;
  resolved_at: string | null;
  created_at: string;
};

export async function fetchAdminActions(status = "pending") {
  const result = await apiRequest<{ items: AdminActionItem[] }>(
    `/admin/actions?status=${encodeURIComponent(status)}`
  );
  return result.items;
}

export async function approveAdminAction(actionId: string) {
  return apiRequest<AdminActionItem>(`/admin/actions/${encodeURIComponent(actionId)}/approve`, {
    method: "POST",
  });
}

export async function rejectAdminAction(actionId: string, notes?: string) {
  return apiRequest<AdminActionItem>(`/admin/actions/${encodeURIComponent(actionId)}/reject`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export type AdminKycDocument = {
  id: string;
  doc_type: string;
  version: number;
  status: string;
  kyc_review_status: string | null;
  immutable_at: string | null;
  original_filename: string;
  mime_type: string;
  created_at: string;
};

export type AdminKycReview = {
  user_id: string;
  client_id: string;
  email: string;
  documents: AdminKycDocument[];
};

export async function fetchAdminKycReview(userId: string) {
  return apiRequest<AdminKycReview>(`/admin/users/${adminUserRefPath(userId)}/kyc-review`);
}

export async function fetchAdminDocumentDownload(documentId: string) {
  return apiRequest<{
    download_url: string;
    expires_in: number;
    mime_type: string;
    filename: string;
    delivery: "cdn" | "signed";
  }>(`/admin/documents/${encodeURIComponent(documentId)}/download`);
}

export async function verifyAdminDocument(documentId: string) {
  return apiRequest(`/admin/documents/${encodeURIComponent(documentId)}/verify`, {
    method: "POST",
  });
}

export async function rejectAdminKycDocument(documentId: string, reason: string) {
  return apiRequest(`/admin/documents/${encodeURIComponent(documentId)}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function verifyAdminUserKycDocuments(userId: string) {
  return apiRequest<{
    verified_count: number;
    skipped_count: number;
    documents: Array<Record<string, unknown>>;
  }>(`/admin/users/${adminUserRefPath(userId)}/documents/verify-kyc`, {
    method: "POST",
  });
}
