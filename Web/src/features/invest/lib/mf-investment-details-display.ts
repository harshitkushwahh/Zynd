import type { InvestFundDetail, InvestInvestmentDetails } from "@/features/invest/api/invest-api";

/** Fund detail API + client fallback when `investment_details` is missing but mins exist. */
export function resolveInvestmentDetailsForDisplay(
  fund: Pick<
    InvestFundDetail,
    "investment_details" | "min_sip_amount_inr" | "min_lumpsum_amount_inr"
  >,
): InvestInvestmentDetails | null {
  if (fund.investment_details) {
    return fund.investment_details;
  }

  const sipMin = fund.min_sip_amount_inr;
  const lumpMin = fund.min_lumpsum_amount_inr;
  if (sipMin == null && lumpMin == null) {
    return null;
  }

  const transactionTypes: string[] = [];
  if (lumpMin != null) transactionTypes.push("purchase");
  if (sipMin != null) transactionTypes.push("sip");

  return {
    lumpsum: lumpMin != null ? { min_inr: lumpMin, max_inr: null, multiples_inr: null } : null,
    additional: null,
    redemption: null,
    switch: null,
    sip_options:
      sipMin != null
        ? [{ frequency: "monthly", min_inr: sipMin, max_inr: null, multiples_inr: null }]
        : [],
    transaction_types: transactionTypes,
  };
}

export function shouldShowInvestmentDetailsCard(
  fund: Pick<
    InvestFundDetail,
    "investment_details" | "min_sip_amount_inr" | "min_lumpsum_amount_inr"
  >,
) {
  return resolveInvestmentDetailsForDisplay(fund) != null;
}
