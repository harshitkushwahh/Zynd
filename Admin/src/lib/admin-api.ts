import { apiRequest } from "@/lib/api-client";
import { pickUserRef, userRefToPath } from "@/lib/admin-user-ref";

function adminUserRefPath(userRef: string) {
  return userRefToPath(pickUserRef({ client_id: userRef, user_id: userRef }));
}

export type SecurityReviewItem = {
  id: string;
  user_id: string;
  client_id: string;
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
  client_id: string;
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

export type AdminAccountListItem = {
  user_id: string;
  client_id: string;
  user_ref: string;
  email: string;
  display_name: string;
  status: string;
  roles: string[];
  mfa_enrolled: boolean;
  suspended_at: string | null;
  suspension_reason_code: string | null;
  deletion_requested_at: string | null;
  deletion_scheduled_at: string | null;
  created_at: string;
};

export async function fetchAdminAccounts() {
  const result = await apiRequest<{ items: AdminAccountListItem[] }>("/admin/admin-accounts");
  return result.items;
}

export async function holdAdminAccountAccess(userId: string, notes?: string) {
  return apiRequest<{
    status: "completed";
    message: string;
  }>(`/admin/admin-accounts/${adminUserRefPath(userId)}/access-hold`, {
    method: "POST",
    body: JSON.stringify({ notes: notes || undefined }),
  });
}

export async function restoreAdminAccountAccess(userId: string) {
  return apiRequest<{
    status: "completed";
    message: string;
  }>(`/admin/admin-accounts/${adminUserRefPath(userId)}/restore-access`, {
    method: "POST",
  });
}

export async function cancelAdminAccountDeletion(userId: string) {
  return apiRequest<{ ok: boolean }>(
    `/admin/admin-accounts/${adminUserRefPath(userId)}/cancel-deletion`,
    { method: "POST" },
  );
}

export async function removeAdminAccount(userId: string) {
  return apiRequest<{
    status: "completed";
    message: string;
  }>(`/admin/admin-accounts/${adminUserRefPath(userId)}/remove`, {
    method: "POST",
  });
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
  profile_image_url: string | null;
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

export type AdminUserDirectoryMetrics = {
  registered_users: number;
  kyc_compliant: number;
  suspended_accounts: number;
  active_investors: number;
};

export async function fetchAdminUserDirectoryMetrics() {
  return apiRequest<AdminUserDirectoryMetrics>("/admin/users/metrics");
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
  user_email?: string | null;
  client_id?: string | null;
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
  phone: string | null;
  profile_image_url: string | null;
  status: string;
  role: string;
  has_invested: boolean;
  suspended_at: string | null;
  suspension_reason_code: string | null;
  mfa_enrolled: boolean;
  pin_enrolled: boolean;
  phone_verified: boolean;
  fund_movement_eligible: boolean;
  last_login_at: string | null;
  last_login_method: string | null;
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
  pep_exposed: string | null;
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

export type AdminUserKycComplianceIssue = {
  id: string;
  step_key: string;
  step_label: string;
  severity: string;
  title: string;
  detail: string;
  status: string;
};

export type AdminUserKycAuditEntry = {
  id: string;
  occurred_at: string;
  action: string;
  step_key: string | null;
  step_label: string | null;
  detail: string;
  actor: string;
  source: string;
};

export type AdminUserKycDetail = {
  overall_status: string;
  last_completed_step: string | null;
  active_step_index: number;
  step_statuses: Record<string, string>;
  incomplete_steps: AdminUserKycStep[];
  kyc_already_registered?: boolean;
  readiness_code?: string | null;
  readiness_reason?: string | null;
  kyc_initiated_at?: string | null;
  esign_details_status?: string | null;
  proof_details_status?: string | null;
  compliance_issues?: AdminUserKycComplianceIssue[];
  audit_log?: AdminUserKycAuditEntry[];
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
  investor_profile_id: string | null;
  mf_investment_profile_id: string | null;
  mf_investment_profile_status: string | null;
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

export type AdminUserGoal = {
  id: string;
  user_id: string;
  family_group_id?: string | null;
  template_id?: string | null;
  template?: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    icon_key: string;
    image_url?: string | null;
    default_tenure_months: number;
    suggested_return_pct?: number | null;
    is_active: boolean;
    sort_order: number;
  } | null;
  title: string;
  tag?: string | null;
  priority: number;
  target_amount_inr: number;
  target_date: string;
  current_amount_inr: number;
  existing_savings_inr: number;
  expected_return_pct?: number | null;
  status: string;
  progress_pct: number;
  linked_product_id?: string | null;
  linked_product_name?: string | null;
  holdings_value_inr?: number | null;
  invested_via_orders_inr?: number | null;
  linked_sip_monthly_inr?: number | null;
  effective_current_amount_inr?: number | null;
  effective_progress_pct?: number | null;
  projected_value_inr?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function fetchAdminUserGoals(userRef: string) {
  return apiRequest<{ items: AdminUserGoal[]; limit: number; active_count: number }>(
    `/admin/users/${adminUserRefPath(userRef)}/goals`,
  );
}

export async function fetchAdminUserGoal(userRef: string, goalId: string) {
  return apiRequest<AdminUserGoal>(
    `/admin/users/${adminUserRefPath(userRef)}/goals/${encodeURIComponent(goalId)}`,
  );
}

export type AdminGoalLinkedProduct = {
  product_id: string;
  product_name: string | null;
  isin: string | null;
};

export type AdminGoalInvestmentHolding = {
  holding_id: number;
  user_id: string;
  owner_display_name: string;
  scheme_name: string;
  matched_scheme_name: string | null;
  folio_number: string;
  isin: string;
  units: number;
  nav_value: number | null;
  market_value_inr: number | null;
  as_of_date: string | null;
  amc_name: string | null;
  source: string;
};

export type AdminGoalInvestmentSipPlan = {
  plan_id: string;
  user_id: string;
  owner_display_name: string;
  product_id: string;
  product_name: string | null;
  amount_inr: number;
  frequency: string;
  installment_day: number | null;
  status: string;
  next_installment_date: string | null;
  is_goal_linked: boolean;
  created_at: string | null;
  activated_at: string | null;
};

export type AdminGoalInvestmentOrder = {
  order_id: string;
  user_id: string;
  owner_display_name: string;
  product_id: string;
  product_name: string | null;
  order_type: string;
  amount_inr: number;
  status: string;
  is_goal_linked: boolean;
  created_at: string | null;
  settled_at: string | null;
};

export type AdminGoalInvestmentContribution = {
  id: string;
  user_id: string;
  owner_display_name: string;
  amount_inr: number;
  source_type: string;
  note: string | null;
  contributed_at: string | null;
};

export type AdminGoalInvestments = {
  goal_id: string;
  linked_product: AdminGoalLinkedProduct | null;
  holdings: AdminGoalInvestmentHolding[];
  sip_plans: AdminGoalInvestmentSipPlan[];
  orders: AdminGoalInvestmentOrder[];
  contributions: AdminGoalInvestmentContribution[];
  summary: {
    holdings_value_inr: number;
    invested_via_orders_inr: number;
    linked_sip_monthly_inr: number;
    contributions_total_inr: number;
    has_linked_investment: boolean;
  };
};

export async function fetchAdminUserGoalInvestments(userRef: string, goalId: string) {
  return apiRequest<AdminGoalInvestments>(
    `/admin/users/${adminUserRefPath(userRef)}/goals/${encodeURIComponent(goalId)}/investments`,
  );
}

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
  target_client_id: string | null;
  target_email: string | null;
  payload: Record<string, unknown>;
  reason: string | null;
  requested_by: string;
  requested_by_client_id: string | null;
  requested_by_email: string | null;
  approved_by: string | null;
  approved_by_client_id: string | null;
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

export async function withdrawAdminAction(actionId: string) {
  return apiRequest<AdminActionItem>(`/admin/actions/${encodeURIComponent(actionId)}/withdraw`, {
    method: "POST",
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

export async function fetchPendingKycReviewCount() {
  return apiRequest<{ count: number }>("/admin/kyc-review/pending-count");
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
