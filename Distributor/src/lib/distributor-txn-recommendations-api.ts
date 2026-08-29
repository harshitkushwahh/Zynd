import { apiRequest } from "@/lib/api-client";

export type MitraTxnRecommendationStatus =
  | "sent"
  | "opened"
  | "invested"
  | "expired"
  | "cancelled";

export type ApiMitraTxnRecommendationItem = {
  id: string;
  product_id: string;
  amount_inr: number;
  number_of_installments: number | null;
  installment_day: number | null;
  fund_name: string;
  product_code: string | null;
  fund_slug: string | null;
  display_order: number;
  amc_name?: string | null;
  amc_slug?: string | null;
  amc_logo_url?: string | null;
};

export type ApiMitraTxnRecommendation = {
  id: string;
  token: string;
  status: MitraTxnRecommendationStatus;
  investment_type: "one_time" | "sip";
  amount_inr: number;
  item_count: number;
  items: ApiMitraTxnRecommendationItem[];
  number_of_installments: number | null;
  installment_day: number | null;
  sip_frequency: string;
  payment_method: "upi" | "netbanking";
  fund_name: string;
  product_code: string | null;
  fund_slug: string | null;
  product_id: string;
  client_user_id: string;
  mitra_user_id: string;
  amc_name?: string | null;
  amc_slug?: string | null;
  amc_logo_url?: string | null;
  client_code: string | null;
  client_email_masked: string | null;
  client_display_name: string | null;
  client_profile_image_url: string | null;
  expires_at: string;
  opened_at: string | null;
  invested_at: string | null;
  created_at: string;
  link: string | null;
};

export type ApiDistributorSchemeSearchItem = {
  product_id: string;
  slug: string | null;
  product_code: string;
  name: string;
  amc_name: string;
  amc_slug: string | null;
  amc_logo_url: string | null;
  category_slug: string | null;
  isin: string;
  min_lumpsum_amount_inr: number | null;
  min_sip_amount_inr: number | null;
  sip_allowed: boolean;
};

export type CreateMitraTxnRecommendationItemPayload = {
  product_id: string;
  amount_inr: number;
  number_of_installments?: number;
  installment_day?: number;
};

export const QUICK_TXN_MAX_FUNDS = 10;

export type CreateMitraTxnRecommendationPayload = {
  investment_type: "one_time" | "sip";
  payment_method: "upi" | "netbanking";
  number_of_installments?: number;
  installment_day?: number;
  sip_frequency?: string;
  items: CreateMitraTxnRecommendationItemPayload[];
};

export async function searchDistributorSchemes(params?: {
  q?: string;
  page?: number;
  page_size?: number;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.page_size) search.set("page_size", String(params.page_size));
  const query = search.toString();
  const path = query ? `/distributor/schemes/search?${query}` : "/distributor/schemes/search";
  return apiRequest<{
    query: string;
    items: ApiDistributorSchemeSearchItem[];
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
  }>(path);
}

export async function fetchMitraTxnRecommendations(params?: { limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const query = search.toString();
  const path = query ? `/distributor/txn-recommendations?${query}` : "/distributor/txn-recommendations";
  return apiRequest<{ items: ApiMitraTxnRecommendation[] }>(path);
}

export async function createMitraTxnRecommendation(
  clientReference: string,
  payload: CreateMitraTxnRecommendationPayload,
) {
  return apiRequest<ApiMitraTxnRecommendation>(
    `/distributor/clients/${encodeURIComponent(clientReference)}/txn-recommendations`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
