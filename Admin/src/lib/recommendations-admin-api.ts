import { apiRequest } from "@/lib/api-client";

export type RiskTierId = "secure" | "conservative" | "moderate" | "growth" | "aggressive";

export type RecommendationConfig = {
  published_version: number;
  published_at: string | null;
  published_by: string | null;
};

export type RecommendationBasket = {
  id: string;
  tier: RiskTierId;
  slug: string;
  name: string;
  display_name?: string | null;
  description: string | null;
  objective_summary: string | null;
  portfolio_display_name: string | null;
  target_allocation: Record<string, number> | null;
  is_active: boolean;
  sort_order: number;
  fund_count: number;
  investable_fund_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type RecommendationBasketFund = {
  id: string;
  product_id: string;
  sort_order: number;
  allocation_weight_pct: number | null;
  portfolio_role: string | null;
  is_anchor: boolean;
  is_alternative: boolean;
  alternative_for_product_id: string | null;
  is_active: boolean;
  fund_id: number | null;
  scheme_name: string | null;
  amc_name: string | null;
  amc_slug: string | null;
  amc_logo_url: string | null;
  lifecycle_status: string | null;
  fund_active: boolean | null;
  amc_empanelled: boolean | null;
};

export type RecommendationBasketDetail = RecommendationBasket & {
  funds: RecommendationBasketFund[];
};

export type RecommendationPreviewFund = {
  product_id: string;
  fund_id: number;
  scheme_name: string;
  amc_name: string;
  amc_logo_url: string | null;
  min_lumpsum_amount_inr: number | null;
};

export type RecommendationPreviewAllocationSlice = {
  id: string;
  label: string;
  value_pct: number;
};

export type RecommendationPreview = {
  eligible: boolean;
  block_reason: string | null;
  tier: string | null;
  basket_name: string | null;
  config_version: number;
  funds: RecommendationPreviewFund[];
  allocation: RecommendationPreviewAllocationSlice[];
};

export type RecommendationPublishIssue = {
  code: string;
  message: string;
  tier?: string | null;
  basket_id?: string | null;
  basket_name?: string | null;
  investable_fund_count?: number | null;
  required_fund_count?: number | null;
};

export type RecommendationPublishWarning = {
  code: string;
  message: string;
  tier?: string | null;
};

export type RecommendationPublishTierSummary = {
  tier: RiskTierId;
  active_basket_count: number;
  ready_basket_count: number;
  short_baskets: Array<{
    basket_id: string;
    basket_name: string;
    investable_fund_count: number;
    required_fund_count: number;
  }>;
};

export type RecommendationPublishReadiness = {
  can_publish: boolean;
  published_version: number;
  required_fund_count: number;
  tiers: RecommendationPublishTierSummary[];
  issues: RecommendationPublishIssue[];
  warnings: RecommendationPublishWarning[];
};

export type RecommendationMetrics = {
  resolve_total: Record<string, number>;
  block_reason_total: Record<string, number>;
  snapshot_hits: number;
  snapshot_misses: number;
  snapshot_hit_rate: number | null;
  degraded_total: number;
  compute_duration_ms_avg: number | null;
  compute_count: number;
};

export async function fetchRecommendationConfig() {
  return apiRequest<RecommendationConfig>("/admin/recommendations/config");
}

export async function fetchRecommendationBaskets(tier?: RiskTierId) {
  const query = tier ? `?tier=${encodeURIComponent(tier)}` : "";
  return apiRequest<{ items: RecommendationBasket[] }>(`/admin/recommendations/baskets${query}`);
}

export async function fetchRecommendationBasket(basketId: string) {
  return apiRequest<RecommendationBasketDetail>(`/admin/recommendations/baskets/${basketId}`);
}

export async function createRecommendationBasket(payload: {
  tier: RiskTierId;
  portfolio_display_name: string;
  slug?: string;
  description?: string;
  objective_summary?: string;
  target_allocation?: Record<string, number>;
  sort_order?: number;
}) {
  return apiRequest<RecommendationBasketDetail>("/admin/recommendations/baskets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRecommendationBasket(
  basketId: string,
  payload: {
    name?: string;
    description?: string;
    objective_summary?: string;
    portfolio_display_name?: string;
    target_allocation?: Record<string, number>;
    is_active?: boolean;
    sort_order?: number;
  },
) {
  return apiRequest<RecommendationBasketDetail>(`/admin/recommendations/baskets/${basketId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteRecommendationBasket(basketId: string) {
  return apiRequest<{ status: string }>(`/admin/recommendations/baskets/${basketId}`, {
    method: "DELETE",
  });
}

export async function replaceRecommendationBasketFunds(
  basketId: string,
  funds: Array<{
    product_id: string;
    sort_order?: number;
    allocation_weight_pct?: number | null;
    portfolio_role?: string | null;
    is_anchor?: boolean;
    is_alternative?: boolean;
    alternative_for_product_id?: string | null;
    is_active?: boolean;
  }>,
) {
  return apiRequest<RecommendationBasketDetail>(`/admin/recommendations/baskets/${basketId}/funds`, {
    method: "PUT",
    body: JSON.stringify({ funds }),
  });
}

export async function addRecommendationBasketFund(
  basketId: string,
  payload: { product_id: string; sort_order?: number },
) {
  return apiRequest<RecommendationBasketDetail>(
    `/admin/recommendations/baskets/${basketId}/funds`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function removeRecommendationBasketFund(basketId: string, productId: string) {
  return apiRequest<RecommendationBasketDetail>(
    `/admin/recommendations/baskets/${basketId}/funds/${productId}`,
    {
      method: "DELETE",
    },
  );
}

export async function previewRecommendationSelection(params: {
  tier: RiskTierId;
  sample_user_id: string;
}) {
  const search = new URLSearchParams({
    tier: params.tier,
    sample_user_id: params.sample_user_id,
  });
  return apiRequest<RecommendationPreview>(`/admin/recommendations/preview?${search.toString()}`);
}

export async function publishRecommendationConfig() {
  return apiRequest<RecommendationConfig>("/admin/recommendations/publish", {
    method: "POST",
  });
}

export async function fetchRecommendationPublishReadiness() {
  return apiRequest<RecommendationPublishReadiness>("/admin/recommendations/publish-readiness");
}

export async function fetchRecommendationMetrics() {
  return apiRequest<RecommendationMetrics>("/admin/recommendations/metrics");
}

export const RECOMMENDATION_RISK_TIERS: Array<{ id: RiskTierId; label: string }> = [
  { id: "secure", label: "Secure" },
  { id: "conservative", label: "Conservative" },
  { id: "moderate", label: "Moderate" },
  { id: "growth", label: "Growth" },
  { id: "aggressive", label: "Aggressive" },
];
