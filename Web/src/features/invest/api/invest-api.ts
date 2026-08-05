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
  slug?: string;
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
    tax_implication?: {
      summary?: string | null;
      stamp_duty_note?: string | null;
      sections?: Array<{ title: string; body: string }>;
    };
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
  data_quality?: string | null;
  disclaimer?: string | null;
  scenarios: InvestReturnCalculatorScenario[];
};

export type MfCalculatorPoint = {
  date: string;
  invested_inr: number | null;
  value_inr: number;
  units: number | null;
};

export type MfLumpsumCalculator = {
  product_id: string;
  mode: "lumpsum";
  amount_inr: number;
  as_of_date: string | null;
  data_quality: string;
  disclaimer: string;
  scenarios: InvestReturnCalculatorScenario[];
  points: MfCalculatorPoint[];
};

export type MfSipCalculator = {
  product_id: string;
  mode: "sip";
  monthly_amount_inr: number;
  duration_months: number;
  sip_day: number;
  total_invested_inr: number;
  projected_value_inr: number;
  return_pct: number | null;
  xirr_pct: number | null;
  installments: number;
  as_of_date: string | null;
  data_quality: string;
  disclaimer: string;
  points: MfCalculatorPoint[];
};

export type MfCompareResponse = {
  funds: InvestFundDetail[];
  disclaimer: string;
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
  sip_enabled: boolean;
  cas_enabled: boolean;
};

export type InvestHomeResponse = {
  categories: InvestCategory[];
  collections?: InvestCategory[];
  popular_funds?: InvestFundSummary[];
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

export function fetchInvestFundDetail(fundRef: string) {
  return apiRequest<InvestFundDetail>(`/invest/funds/${encodeURIComponent(fundRef)}`);
}

export function fetchInvestFundNavs(fundRef: string, limit = 365) {
  return apiRequest<InvestFundNavHistory>(`/invest/funds/${encodeURIComponent(fundRef)}/navs?limit=${limit}`);
}

export function fetchInvestReturnCalculator(
  fundRef: string,
  params?: {
    amount_inr?: number;
    mode?: "lumpsum" | "sip";
    horizons?: string;
    duration_months?: number;
    sip_day?: number;
  },
) {
  const search = new URLSearchParams();
  if (params?.amount_inr != null) search.set("amount_inr", String(params.amount_inr));
  if (params?.mode) search.set("mode", params.mode);
  if (params?.horizons) search.set("horizons", params.horizons);
  if (params?.duration_months != null) search.set("duration_months", String(params.duration_months));
  if (params?.sip_day != null) search.set("sip_day", String(params.sip_day));
  const query = search.toString();
  return apiRequest<InvestReturnCalculator>(
    `/invest/funds/${encodeURIComponent(fundRef)}/return-calculator${query ? `?${query}` : ""}`,
  );
}

export function fetchMfLumpsumCalculator(
  fundRef: string,
  params?: { amount_inr?: number; horizons?: string },
) {
  const search = new URLSearchParams();
  if (params?.amount_inr != null) search.set("amount_inr", String(params.amount_inr));
  if (params?.horizons) search.set("horizons", params.horizons);
  const query = search.toString();
  return apiRequest<MfLumpsumCalculator>(
    `/invest/funds/${encodeURIComponent(fundRef)}/calculators/lumpsum${query ? `?${query}` : ""}`,
  );
}

export function fetchMfSipCalculator(
  fundRef: string,
  params?: { monthly_amount_inr?: number; duration_months?: number; sip_day?: number },
) {
  const search = new URLSearchParams();
  if (params?.monthly_amount_inr != null) {
    search.set("monthly_amount_inr", String(params.monthly_amount_inr));
  }
  if (params?.duration_months != null) search.set("duration_months", String(params.duration_months));
  if (params?.sip_day != null) search.set("sip_day", String(params.sip_day));
  const query = search.toString();
  return apiRequest<MfSipCalculator>(
    `/invest/funds/${encodeURIComponent(fundRef)}/calculators/sip${query ? `?${query}` : ""}`,
  );
}

export function compareMfFunds(productIds: string[]) {
  return apiRequest<MfCompareResponse>("/invest/funds/compare", {
    method: "POST",
    body: JSON.stringify({ product_ids: productIds }),
  });
}

export type MfOrder = {
  order_id: string;
  checkout_id: string | null;
  product_id: string;
  product_name: string | null;
  amc_name: string | null;
  amc_logo_url: string | null;
  order_type: string;
  amount_inr: number;
  payment_method: MfPaymentMethod | null;
  status: string;
  fp_purchase_id: string | null;
  fp_purchase_old_id: number | null;
  fp_state: string | null;
  payment_url: string | null;
  next_action: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string | null;
  submitted_at: string | null;
  settled_at: string | null;
  payout_bank_account_id?: string | null;
  payout_bank_account_masked?: string | null;
  payout_bank_ifsc_code?: string | null;
  payout_bank_name?: string | null;
};

export type MfOrderListResponse = {
  orders: MfOrder[];
};

export type MfOrderEvent = {
  from_status: string | null;
  to_status: string;
  source: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
};

export type MfOrderJourneyResponse = {
  order: MfOrder;
  events: MfOrderEvent[];
};

export type MfPaymentMethod = "upi" | "netbanking";
export type MfMandateType = "upi" | "nach";

export function createMfOrder(body: {
  product_id: string;
  amount_inr: number;
  idempotency_key: string;
  bank_account_id?: string;
  family_goal_id?: string;
  payment_method?: MfPaymentMethod;
}) {
  return apiRequest<MfOrder>("/invest/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchMfOrders(limit = 100) {
  return apiRequest<MfOrderListResponse>(`/invest/orders?limit=${limit}`);
}

export function fetchMfOrder(orderId: string) {
  return apiRequest<MfOrder>(`/invest/orders/${orderId}`);
}

export function fetchMfOrderJourney(orderId: string) {
  return apiRequest<MfOrderJourneyResponse>(`/invest/orders/${orderId}/journey`);
}

export function abandonMfOrderPayment(orderId: string) {
  return apiRequest<MfOrder>(`/invest/orders/${orderId}/abandon-payment`, {
    method: "POST",
  });
}

export type MfCartItem = {
  product_id: string;
  product_name: string | null;
  fund_id: number;
  amc_name: string | null;
  amc_logo_url: string | null;
  amount_inr: number;
  investment_type: "lumpsum" | "sip";
  installment_day: number | null;
  frequency: string | null;
  number_of_installments: number | null;
  fp_scheme_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MfCart = {
  items: MfCartItem[];
  lumpsum_items: MfCartItem[];
  sip_items: MfCartItem[];
  item_count: number;
  lumpsum_item_count: number;
  sip_item_count: number;
  total_amount_inr: number;
  lumpsum_total_amount_inr: number;
  sip_total_amount_inr: number;
  max_items: number;
};

export type MfCheckoutOrderLine = {
  order_id: string;
  product_id: string;
  product_name: string | null;
  amount_inr: number;
  status: string;
  line_index: number;
  fp_state: string | null;
};

export type MfCheckout = {
  checkout_id: string;
  checkout_type: string;
  status: string;
  total_amount_inr: number;
  payment_method: MfPaymentMethod | null;
  payment_url: string | null;
  next_action: string | null;
  fp_payment_id: number | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string | null;
  payout_bank_account_id?: string | null;
  payout_bank_account_masked?: string | null;
  payout_bank_ifsc_code?: string | null;
  payout_bank_name?: string | null;
  orders: MfCheckoutOrderLine[];
};

export function fetchMfCart() {
  return apiRequest<MfCart>("/invest/cart");
}

export function upsertMfCartItem(body: {
  product_id: string;
  amount_inr: number;
  investment_type?: "lumpsum" | "sip";
  installment_day?: number;
  frequency?: "monthly" | "daily";
  number_of_installments?: number;
}) {
  return apiRequest<MfCart>("/invest/cart/items", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function bulkUpsertMfCartItems(body: {
  items: Array<{ product_id: string; amount_inr: number }>;
}) {
  return apiRequest<MfCart>("/invest/cart/items/bulk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function removeMfCartItem(productId: string, investmentType: "lumpsum" | "sip" = "lumpsum") {
  return apiRequest<MfCart>(`/invest/cart/items/${productId}?investment_type=${investmentType}`, {
    method: "DELETE",
  });
}

export function clearMfCartTab(investmentType: "lumpsum" | "sip") {
  return apiRequest<MfCart>(`/invest/cart/clear?investment_type=${investmentType}`, {
    method: "DELETE",
  });
}

export function checkoutMfCart(body: {
  idempotency_key: string;
  bank_account_id?: string;
  family_goal_id?: string;
  payment_method?: MfPaymentMethod;
}) {
  return apiRequest<MfCheckout>("/invest/cart/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function checkoutMfSipCart(body: {
  idempotency_key: string;
  bank_account_id?: string;
  family_goal_id?: string;
  mandate_type?: MfMandateType;
}) {
  return apiRequest<{ plans: MfSipPlan[] }>("/invest/cart/sip/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchMfCheckout(checkoutId: string) {
  return apiRequest<MfCheckout>(`/invest/cart/checkout/${checkoutId}`);
}

export function abandonMfCheckoutPayment(checkoutId: string) {
  return apiRequest<MfCheckout>(`/invest/cart/checkout/${checkoutId}/abandon-payment`, {
    method: "POST",
  });
}

export type MfMandate = {
  mandate_id: string;
  status: string;
  fp_mandate_id: number | null;
  bank_account_old_id: number;
  mandate_type: string;
  mandate_limit: number;
  fp_mandate_status: string | null;
  auth_url: string | null;
  next_action: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string | null;
  approved_at: string | null;
};

export type MfSipPlan = {
  plan_id: string;
  product_id: string;
  product_name: string | null;
  amc_name: string | null;
  amc_logo_url: string | null;
  isin: string | null;
  amount_inr: number;
  frequency: string;
  installment_day: number | null;
  number_of_installments: number;
  status: string;
  fp_plan_id: string | null;
  fp_state: string | null;
  next_installment_date: string | null;
  mandate: MfMandate | null;
  mandate_auth_url: string | null;
  next_action: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string | null;
  activated_at: string | null;
};

export type MfMandateListResponse = {
  mandates: MfMandate[];
};

export type MfSipPlanListResponse = {
  plans: MfSipPlan[];
};

export function fetchMfMandates() {
  return apiRequest<MfMandateListResponse>("/invest/mandates");
}

export function createMfMandate(body: {
  idempotency_key: string;
  installment_amount_inr?: number;
  bank_account_id?: string;
  mandate_type?: MfMandateType;
}) {
  return apiRequest<MfMandate>("/invest/mandates", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function authMfMandate(mandateId: string) {
  return apiRequest<MfMandate>(`/invest/mandates/${mandateId}/auth`, { method: "POST" });
}

export function cancelMfMandate(mandateId: string) {
  return apiRequest<MfMandate>(`/invest/mandates/${mandateId}/cancel`, {
    method: "POST",
  });
}

export function createMfSipPlan(body: {
  product_id: string;
  amount_inr: number;
  frequency: "monthly" | "daily";
  installment_day?: number;
  number_of_installments: number;
  mandate_id?: string;
  idempotency_key: string;
  bank_account_id?: string;
  family_goal_id?: string;
  mandate_type?: MfMandateType;
}) {
  return apiRequest<MfSipPlan>("/invest/sip/plans", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchMfSipPlan(planId: string) {
  return apiRequest<MfSipPlan>(`/invest/sip/plans/${planId}`);
}

export function cancelMfSipPlan(planId: string) {
  return apiRequest<MfSipPlan>(`/invest/sip/plans/${planId}/cancel`, {
    method: "POST",
  });
}

export function fetchMfSipPlans() {
  return apiRequest<MfSipPlanListResponse>("/invest/sip/plans");
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
  amc_logo_url: string | null;
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
