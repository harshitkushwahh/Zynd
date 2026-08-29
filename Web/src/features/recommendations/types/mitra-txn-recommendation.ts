export type MitraTxnRecommendationStatus =
  | "sent"
  | "opened"
  | "invested"
  | "expired"
  | "cancelled";

export type MitraTxnRecommendationItem = {
  id: string;
  product_id: string;
  amount_inr: number;
  number_of_installments: number | null;
  installment_day: number | null;
  fund_name: string;
  product_code: string | null;
  fund_slug: string | null;
  display_order: number;
};

export type MitraTxnRecommendation = {
  id: string;
  token: string;
  status: MitraTxnRecommendationStatus;
  investment_type: "one_time" | "sip";
  amount_inr: number;
  item_count: number;
  items: MitraTxnRecommendationItem[];
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
  expires_at: string;
  opened_at: string | null;
  invested_at: string | null;
  created_at: string;
  cart_path: string;
  fund_path: string;
};

export type ApplyMitraTxnRecommendationResponse = {
  applied: boolean;
  status: MitraTxnRecommendationStatus;
  redirect_path: string;
  recommendation: MitraTxnRecommendation;
};
