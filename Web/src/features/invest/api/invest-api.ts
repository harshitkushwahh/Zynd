import { apiRequest } from "@/lib/api-client";

export type InvestReturns = {
  return_1d: number | null;
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
  return_1y: number | null;
  return_3y: number | null;
  return_5y: number | null;
};

export type InvestCategory = {
  id: number;
  slug: string;
  name: string;
  fund_count: number;
};

export type InvestFundDisplay = {
  tagline: string | null;
  hero_badge: string | null;
  risk_label: string | null;
};

export type InvestFundContent = InvestFundDisplay & {
  benchmark_name: string | null;
  fund_manager_name: string | null;
  disclaimer_text: string | null;
  seo_slug: string | null;
  seo_meta_description: string | null;
  amc_marketing_name: string | null;
  amc_description: string | null;
  amc_website_url: string | null;
};

export type InvestAmountConstraint = {
  min_inr?: number | null;
  max_inr?: number | null;
  multiples_inr?: number | null;
};

export type InvestRedemptionConstraint = InvestAmountConstraint & {
  min_units?: number | null;
  unit_multiples?: number | null;
};

export type InvestSipOption = {
  frequency: string;
  min_inr?: number | null;
  max_inr?: number | null;
  multiples_inr?: number | null;
  min_installments?: number | null;
};

export type InvestInvestmentDetails = {
  lumpsum?: InvestAmountConstraint | null;
  additional?: InvestAmountConstraint | null;
  redemption?: InvestRedemptionConstraint | null;
  switch?: {
    min_in_inr?: number | null;
    min_out_inr?: number | null;
    min_out_units?: number | null;
  } | null;
  sip_options: InvestSipOption[];
  transaction_types: string[];
};

export type InvestFundSummary = {
  product_id: string;
  product_code: string;
  name: string;
  provider: string | null;
  amc_name: string;
  amc_slug: string;
  amc_logo_url: string | null;
  category_slug: string | null;
  isin: string;
  rank_position: number | null;
  sebi_category: string | null;
  min_sip_amount_inr: number | null;
  min_lumpsum_amount_inr: number | null;
  is_featured?: boolean;
  display_order?: number;
  health_badges?: string[];
  display?: InvestFundDisplay | null;
  returns: InvestReturns;
};

export type InvestFundDetail = InvestFundSummary & {
  category_name: string | null;
  plan_type: string | null;
  option_type: string | null;
  latest_nav: number | null;
  latest_nav_date: string | null;
  aum_inr: number | null;
  aum_as_of: string | null;
  ter_percent: number | null;
  ter_as_of: string | null;
  disclaimer: string | null;
  distributor_arn: string | null;
  distributor_euin: string | null;
  content?: InvestFundContent | null;
  compliance?: {
    exit_load?: { text?: string | null; slabs?: unknown[] };
    stamp_duty_pct?: number;
    tax_implication?: { summary?: string | null; sections?: Array<{ title: string; body: string }> };
    lock_in_days?: number | null;
    source?: string;
  } | null;
  fund_house?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    address?: string | null;
    custodian?: string | null;
    rta?: { name?: string | null; email?: string | null; website?: string | null; address?: string | null };
    incorporation_date?: string | null;
  } | null;
  amc_aum_rank?: {
    position: number;
    peer_count: number;
    total_aum_inr?: number | null;
    as_of_date?: string;
    label?: string;
  } | null;
  investment_details?: InvestInvestmentDetails | null;
};

export type InvestReturnCalculatorScenario = {
  horizon: string;
  invested_inr: number;
  value_inr: number;
  return_pct: number | null;
};

export type InvestReturnCalculator = {
  product_id: string;
  amount_inr: number;
  mode: string;
  as_of_date: string | null;
  scenarios: InvestReturnCalculatorScenario[];
};

export type InvestNavPoint = {
  date: string;
  nav: number | null;
};

export type InvestFundNavHistory = {
  product_id: string;
  from_date: string;
  to_date: string;
  count: number;
  points: InvestNavPoint[];
};

export type InvestConfig = {
  distributor_arn: string | null;
  distributor_euin: string | null;
  disclaimer: string;
  orders_enabled: boolean;
  cas_enabled: boolean;
};

export type InvestHomeResponse = {
  categories: InvestCategory[];
  featured_funds: InvestFundSummary[];
  total_active_funds: number;
};

export type InvestFundListResponse = {
  items: InvestFundSummary[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
};

export type InvestFundSearchResponse = InvestFundListResponse & {
  query: string;
};

export function fetchInvestHome() {
  return apiRequest<InvestHomeResponse>("/invest/home");
}

export function fetchInvestConfig() {
  return apiRequest<InvestConfig>("/invest/config");
}

export function fetchInvestFunds(params?: {
  category?: string;
  page?: number;
  page_size?: number;
  sort?: "rank" | "return_3y" | "name";
}) {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.page) search.set("page", String(params.page));
  if (params?.page_size) search.set("page_size", String(params.page_size));
  if (params?.sort) search.set("sort", params.sort);
  const query = search.toString();
  return apiRequest<InvestFundListResponse>(`/invest/funds${query ? `?${query}` : ""}`);
}

export function fetchInvestSearch(params: {
  q: string;
  page?: number;
  page_size?: number;
}) {
  const search = new URLSearchParams();
  search.set("q", params.q);
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  return apiRequest<InvestFundSearchResponse>(`/invest/search?${search.toString()}`);
}

export function fetchInvestFundDetail(productId: string) {
  return apiRequest<InvestFundDetail>(`/invest/funds/${productId}`);
}

export function fetchInvestFundNavs(productId: string, limit = 365) {
  return apiRequest<InvestFundNavHistory>(`/invest/funds/${productId}/navs?limit=${limit}`);
}

export function fetchInvestReturnCalculator(
  productId: string,
  params?: { amount_inr?: number; mode?: "lumpsum" | "sip"; horizons?: string },
) {
  const search = new URLSearchParams();
  if (params?.amount_inr != null) search.set("amount_inr", String(params.amount_inr));
  if (params?.mode) search.set("mode", params.mode);
  if (params?.horizons) search.set("horizons", params.horizons);
  const query = search.toString();
  return apiRequest<InvestReturnCalculator>(
    `/invest/funds/${productId}/return-calculator${query ? `?${query}` : ""}`,
  );
}

export type MfOrder = {
  order_id: string;
  product_id: string;
  product_name: string | null;
  order_type: string;
  amount_inr: number;
  status: string;
  fp_purchase_id: string | null;
  created_at: string | null;
};

export type MfOrderListResponse = {
  orders: MfOrder[];
};

export function createMfOrder(body: {
  product_id: string;
  amount_inr: number;
  idempotency_key: string;
}) {
  return apiRequest<MfOrder>("/invest/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchMfOrders() {
  return apiRequest<MfOrderListResponse>("/invest/orders");
}

export type MfExternalHolding = {
  isin: string;
  scheme_name: string;
  matched_scheme_name: string | null;
  folio_number: string;
  units: number;
  nav_value: number | null;
  market_value_inr: number | null;
  as_of_date: string | null;
  amc_name: string | null;
  source: string;
};

export type MfHoldingsResponse = {
  external_holdings: MfExternalHolding[];
};

export function fetchExternalHoldings() {
  return apiRequest<MfHoldingsResponse>("/invest/holdings/external");
}

export type MfCasImport = {
  import_id: string;
  status: string;
  external_request_id: string | null;
  holdings_count: number;
  failure_reason: string | null;
  requested_at: string | null;
  completed_at: string | null;
};

export function requestCasImport() {
  return apiRequest<MfCasImport>("/invest/cas/imports", { method: "POST" });
}
