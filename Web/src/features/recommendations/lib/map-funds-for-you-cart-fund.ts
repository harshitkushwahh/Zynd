import type { MfFundScreenerDragPayload } from "@/features/invest/lib/mf-fund-screener-drag";
import type { FundsForYouFund } from "@/features/recommendations/types/funds-for-you";

export function mapFundsForYouCartFund(fund: FundsForYouFund): MfFundScreenerDragPayload {
  return {
    product_id: fund.product_id,
    name: fund.scheme_name,
    min_lumpsum_amount_inr: fund.min_lumpsum_amount_inr,
    amc_name: fund.amc_name,
    amc_slug: fund.amc_slug ?? "",
    amc_logo_url: fund.amc_logo_url,
  };
}
