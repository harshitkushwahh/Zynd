import { apiRequest } from "@/lib/api-client";

export type AdminPendingDistributorPartner = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  pan_masked: string | null;
  arn: string;
  euin: string;
  status: string;
  profile_payload: Record<string, unknown>;
  profile_image_url: string | null;
  onboarded_by_user_id: string | null;
  ho_reviewed_at: string | null;
  ho_rejection_reason: string | null;
  created_at: string;
  manager_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
};

export async function fetchPendingDistributorPartners() {
  return apiRequest<{ items: AdminPendingDistributorPartner[] }>("/admin/distributor-partners/pending");
}

export async function fetchDistributorPartner(partnerId: string) {
  return apiRequest<{ partner: AdminPendingDistributorPartner }>(
    `/admin/distributor-partners/${encodeURIComponent(partnerId)}`,
  );
}

export async function approveDistributorPartner(partnerId: string, payload: { arn: string; euin?: string }) {
  return apiRequest<{ partner_id: string; status: string; arn: string; euin: string | null }>(
    `/admin/distributor-partners/${partnerId}/approve`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function rejectDistributorPartner(partnerId: string, reason: string) {
  return apiRequest<{ partner_id: string; status: string }>(
    `/admin/distributor-partners/${partnerId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
}
