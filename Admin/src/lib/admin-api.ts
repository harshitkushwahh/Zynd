import { apiRequest } from "@/lib/api-client";

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
    roles: Array<{
      key: string;
      name: string;
      description: string;
      permissions: string[];
    }>;
  }>("/admin/rbac/roles");
  return result.roles;
}

export type AdminUserSummary = {
  user_id: string;
  email: string;
  status: string;
  role: string;
  suspended_at: string | null;
  suspension_reason_code: string | null;
  mfa_enrolled: boolean;
  created_at: string;
};

export async function fetchAdminUserSummary(userId: string) {
  return apiRequest<AdminUserSummary>(`/admin/users/${encodeURIComponent(userId)}`);
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
  }>(`/admin/users/${encodeURIComponent(userId)}/suspend`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function unsuspendAdminUser(userId: string) {
  return apiRequest<{
    status: "pending";
    action_id: string;
    message: string;
  }>(`/admin/users/${encodeURIComponent(userId)}/unsuspend`, {
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
  return apiRequest<AdminKycReview>(`/admin/users/${encodeURIComponent(userId)}/kyc-review`);
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
  }>(`/admin/users/${encodeURIComponent(userId)}/documents/verify-kyc`, {
    method: "POST",
  });
}
