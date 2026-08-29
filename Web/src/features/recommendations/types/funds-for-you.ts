export type FundsForYouBlockReason =
  | "kyc_required"
  | "risk_profile_required"
  | "no_baskets"
  | "insufficient_funds";

export type FundsForYouFund = {
  product_id: string;
  fund_id: number;
  scheme_name: string;
  amc_name: string;
  amc_logo_url: string | null;
  amc_slug: string | null;
  min_lumpsum_amount_inr: number | null;
  in_cart: boolean;
  in_portfolio: boolean;
};

export type FundsForYouPortfolioStory = {
  display_name: string | null;
  mix_summary: string | null;
  why_this_mix: string | null;
  basket_objective: string | null;
};

export type FundsForYouAllocationSlice = {
  id: string;
  label: string;
  value_pct: number;
};

export type FundsForYouResponse = {
  eligible: boolean;
  block_reason: FundsForYouBlockReason | null;
  tier: string | null;
  basket_name: string | null;
  config_version: number;
  portfolio_story: FundsForYouPortfolioStory | null;
  funds: FundsForYouFund[];
  allocation: FundsForYouAllocationSlice[];
};
