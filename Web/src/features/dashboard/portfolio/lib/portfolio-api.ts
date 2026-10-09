import { apiRequest } from "@/lib/api-client";

export type PortfolioAllocationSlice = {
  id: string;
  label: string;
  value_pct: number;
  color: string;
};

export type PortfolioGrowthPoint = {
  label: string;
  value: number;
  date?: string | null;
  invested?: number | null;
};

export type PortfolioUpcomingSip = {
  plan_id: string;
  product_id: string;
  product_name: string | null;
  amount_inr: number;
  next_installment_date: string | null;
};

export type PortfolioSummaryResponse = {
  status: string;
  has_pending_orders: boolean;
  current_value_inr: number;
  invested_inr: number;
  total_return_inr: number;
  total_return_pct: number;
  day_change_inr: number | null;
  day_change_pct: number | null;
  xirr_pct: number | null;
  holdings_count: number;
  active_sips_count: number;
  monthly_sip_inr: number;
  upcoming_sips: PortfolioUpcomingSip[];
  allocation: PortfolioAllocationSlice[];
  growth: PortfolioGrowthPoint[];
  as_on: string | null;
};

export type PortfolioHoldingResponse = {
  id: string;
  folio_number: string;
  isin: string;
  fund_name: string;
  amc_name: string | null;
  amc_slug?: string | null;
  amc_logo_url: string | null;
  units: number;
  redeemable_units: number;
  current_value_inr: number;
  redeemable_amount_inr: number | null;
  invested_inr: number;
  return_inr: number;
  return_pct: number;
  allocation_pct: number;
  nav: number | null;
  nav_as_on: string | null;
  source?: string | null;
  day_change_inr?: number | null;
  day_change_pct?: number | null;
};

export type PortfolioHoldingsListResponse = {
  status: string;
  has_pending_orders: boolean;
  holdings: PortfolioHoldingResponse[];
  as_on: string | null;
};

export type PortfolioHoldingTransactionResponse = {
  id: string;
  date: string;
  type: string;
  units: number;
  nav: number;
  value_inr: number;
};

export type PortfolioHoldingSipOption = {
  frequency: string;
  min_inr?: number | null;
  max_inr?: number | null;
  multiples_inr?: number | null;
  min_installments?: number | null;
};

export type PortfolioHoldingDetailResponse = PortfolioHoldingResponse & {
  holding_mode: string | null;
  invested_months: number | null;
  avg_nav: number | null;
  current_nav: number | null;
  day_change_inr: number | null;
  day_change_pct: number | null;
  xirr_pct: number | null;
  redeem_bank_label: string | null;
  redeem_bank_name: string | null;
  redeem_bank_ifsc: string | null;
  nominee_name: string | null;
  product_id?: string | null;
  min_sip_amount_inr?: number | null;
  min_lumpsum_amount_inr?: number | null;
  sip_allowed?: boolean;
  sip_options?: PortfolioHoldingSipOption[];
  transactions: PortfolioHoldingTransactionResponse[];
  pending_action?: PortfolioHoldingPendingActionResponse | null;
};

export type PortfolioHoldingPendingActionResponse = {
  kind: "switch" | "redeem";
  status: string;
  order_id: string;
  amount_inr: number;
  confirmed: boolean;
  switch_in_scheme?: string | null;
  switch_in_product_id?: string | null;
};

export type PortfolioHoldingDetailEnvelopeResponse = {
  status: string;
  holding: PortfolioHoldingDetailResponse | null;
};

export function fetchPortfolioSummary() {
  return apiRequest<PortfolioSummaryResponse>("/invest/portfolio/summary");
}

export function fetchPortfolioHoldings() {
  return apiRequest<PortfolioHoldingsListResponse>("/invest/portfolio/holdings");
}

export function fetchPortfolioHoldingDetail(holdingId: string) {
  const params = new URLSearchParams({ holding_id: holdingId });
  return apiRequest<PortfolioHoldingDetailEnvelopeResponse>(
    `/invest/portfolio/holdings/detail?${params.toString()}`,
  );
}

export type PortfolioActiveRedemption = {
  fp_redemption_id: string;
  status: string;
  amount_inr: number;
  units: number;
  placed_at: string | null;
  folio_number: string;
  isin: string | null;
};

export type PortfolioRedeemUnitsItem = PortfolioHoldingResponse & {
  active_redemption: PortfolioActiveRedemption | null;
};

export type PortfolioRedeemUnitsListResponse = {
  status: string;
  items: PortfolioRedeemUnitsItem[];
  as_on: string | null;
};

export type MfRedemptionJourneyEvent = {
  from_status: string | null;
  to_status: string;
  source: string;
  payload: Record<string, unknown> | null;
  created_at: string | null;
};

export type MfRedemptionJourney = {
  order_id: string;
  status: string;
  amount_inr: number;
  units: number;
  placed_at: string;
  folio_number: string | null;
  isin: string | null;
  events: MfRedemptionJourneyEvent[];
};

export type MfRedemptionJourneyEnvelope = {
  status: string;
  journey: MfRedemptionJourney | null;
};

export function fetchPortfolioRedeemUnits() {
  return apiRequest<PortfolioRedeemUnitsListResponse>("/invest/portfolio/redeem-units");
}

export function fetchRedemptionJourney(fpRedemptionId: string) {
  return apiRequest<MfRedemptionJourneyEnvelope>(`/invest/redemptions/${fpRedemptionId}/journey`);
}

export type MfRedemptionOrder = {
  order_id: string;
  product_id: string;
  product_name: string | null;
  order_type: string;
  amount_inr: number;
  status: string;
  fp_redemption_id: string | null;
  fp_state: string | null;
  holding_id: string | null;
  folio_number: string | null;
  isin: string | null;
  units: number | null;
  redeem_mode: string | null;
  next_action: string | null;
  consent_otp_sent: boolean;
  redemption_confirmed: boolean;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string | null;
  submitted_at: string | null;
  settled_at: string | null;
};

export type MfRedemptionConsent = {
  order_id: string;
  fp_redemption_id: string;
  status: string;
  fp_state: string | null;
  masked_email: string;
  masked_mobile: string;
  consent_otp_sent: boolean;
  redemption_confirmed: boolean;
};

export type CreateMfRedemptionPayload = {
  holding_id: string;
  idempotency_key: string;
  redeem_mode: "amount" | "units" | "all";
  amount_inr?: number;
  units?: number;
};

export function createMfRedemption(payload: CreateMfRedemptionPayload) {
  return apiRequest<MfRedemptionOrder>("/invest/redemptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchMfRedemptionConsent(orderId: string) {
  return apiRequest<MfRedemptionConsent>(`/invest/redemptions/${orderId}/consent`);
}

export function sendMfRedemptionConsentOtp(orderId: string) {
  return apiRequest<{ order_id: string; masked_mobile: string; retry_after_seconds: number }>(
    `/invest/redemptions/${orderId}/consent/send-otp`,
    { method: "POST" },
  );
}

export function confirmMfRedemption(orderId: string, otp: string) {
  return apiRequest<MfRedemptionOrder>(`/invest/redemptions/${orderId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}

export type MfSwitchDestination = {
  product_id: string;
  fund_id: number;
  isin: string;
  name: string;
  seo_slug: string | null;
  amc_name: string | null;
  amc_slug: string | null;
  amc_logo_url: string | null;
};

export type MfSwitchOrder = {
  order_id: string;
  product_id: string;
  product_name: string | null;
  order_type: string;
  amount_inr: number;
  status: string;
  fp_switch_id: string | null;
  fp_state: string | null;
  holding_id: string | null;
  folio_number: string | null;
  isin: string | null;
  switch_in_scheme: string | null;
  switch_in_product_id: string | null;
  units: number | null;
  switch_mode: string | null;
  next_action: string | null;
  consent_otp_sent: boolean;
  switch_confirmed: boolean;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string | null;
  submitted_at: string | null;
  settled_at: string | null;
};

export type MfSystematicPlan = {
  plan_id: string;
  kind: string;
  product_id: string;
  product_name: string | null;
  amount_inr: number;
  frequency: string;
  installment_day: number | null;
  number_of_installments: number;
  folio_number: string | null;
  status: string;
  fp_plan_id: string | null;
  fp_state: string | null;
  next_installment_date: string | null;
  next_action: string | null;
  consent_otp_sent: boolean;
  plan_confirmed: boolean;
  switch_in_product_id: string | null;
  switch_in_name: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
};

export function fetchMfSwitchDestinations(holdingId: string) {
  return apiRequest<{ destinations: MfSwitchDestination[] }>(
    `/invest/switches/destinations?holding_id=${encodeURIComponent(holdingId)}`,
  );
}

export function createMfSwitch(payload: {
  holding_id: string;
  switch_in_product_id: string;
  idempotency_key: string;
  switch_mode: "amount" | "units" | "all";
  amount_inr?: number;
  units?: number;
}) {
  return apiRequest<MfSwitchOrder>("/invest/switches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchMfSwitchConsent(orderId: string) {
  return apiRequest<{
    order_id: string;
    fp_switch_id: string;
    masked_email: string;
    masked_mobile: string;
    consent_otp_sent: boolean;
    switch_confirmed: boolean;
  }>(`/invest/switches/${orderId}/consent`);
}

export function sendMfSwitchConsentOtp(orderId: string) {
  return apiRequest<{ order_id: string; masked_mobile: string; retry_after_seconds: number }>(
    `/invest/switches/${orderId}/consent/send-otp`,
    { method: "POST" },
  );
}

export function confirmMfSwitch(orderId: string, otp: string) {
  return apiRequest<MfSwitchOrder>(`/invest/switches/${orderId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}

export function createMfSwpPlan(payload: {
  holding_id: string;
  idempotency_key: string;
  amount_inr: number;
  installment_day: number;
  number_of_installments: number;
}) {
  return apiRequest<MfSystematicPlan>("/invest/swp/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createMfStpPlan(payload: {
  holding_id: string;
  switch_in_product_id: string;
  idempotency_key: string;
  amount_inr: number;
  installment_day: number;
  number_of_installments: number;
}) {
  return apiRequest<MfSystematicPlan>("/invest/stp/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchMfSystematicPlanConsent(kind: "swp" | "stp", planId: string) {
  return apiRequest<{
    plan_id: string;
    masked_email: string;
    masked_mobile: string;
    consent_otp_sent: boolean;
    plan_confirmed: boolean;
  }>(`/invest/${kind}/plans/${planId}/consent`);
}

export function sendMfSystematicPlanOtp(kind: "swp" | "stp", planId: string) {
  return apiRequest<{ plan_id: string; masked_mobile: string; retry_after_seconds: number }>(
    `/invest/${kind}/plans/${planId}/consent/send-otp`,
    { method: "POST" },
  );
}

export function confirmMfSystematicPlan(kind: "swp" | "stp", planId: string, otp: string) {
  return apiRequest<MfSystematicPlan>(`/invest/${kind}/plans/${planId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}
