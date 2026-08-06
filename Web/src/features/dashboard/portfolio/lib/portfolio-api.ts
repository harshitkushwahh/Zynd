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

export type PortfolioHoldingDetailResponse = PortfolioHoldingResponse & {
  holding_mode: string | null;
  invested_months: number | null;
  avg_nav: number | null;
  current_nav: number | null;
  day_change_inr: number | null;
  day_change_pct: number | null;
  xirr_pct: number | null;
  redeem_bank_label: string | null;
  nominee_name: string | null;
  transactions: PortfolioHoldingTransactionResponse[];
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
