import type { InvestFundSummary, MfCart } from "@/features/invest/api/invest-api";
import { remainingMfCartSlots } from "@/features/invest/lib/mf-cart-limits";

/** Default one-time amount when queueing funds from the fund screener. */
export const SCREENER_CART_DEFAULT_LUMPSUM_INR = 1000;

export function resolveScreenerCartLumpsumAmount(
  minLumpsumAmountInr: number | null | undefined,
): number {
  if (
    minLumpsumAmountInr != null &&
    Number.isFinite(minLumpsumAmountInr) &&
    minLumpsumAmountInr > SCREENER_CART_DEFAULT_LUMPSUM_INR
  ) {
    return Math.trunc(minLumpsumAmountInr);
  }
  return SCREENER_CART_DEFAULT_LUMPSUM_INR;
}

export function resolveLumpsumAmountForFund(fund: InvestFundSummary, amountInr: number) {
  const min = fund.min_lumpsum_amount_inr ?? 1;
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    return min;
  }
  return Math.max(amountInr, min);
}

export function buildBulkCartItems(
  funds: InvestFundSummary[],
  amountInr: number,
  cart: Pick<MfCart, "max_items" | "lumpsum_item_count" | "sip_item_count" | "items">,
) {
  const existingIds = new Set(
    cart.items
      .filter((item) => item.investment_type === "lumpsum")
      .map((item) => item.product_id),
  );
  let newSlots = remainingMfCartSlots(cart, "lumpsum");
  const lines: Array<{ product_id: string; amount_inr: number }> = [];

  for (const fund of funds) {
    const line = {
      product_id: fund.product_id,
      amount_inr: resolveLumpsumAmountForFund(fund, amountInr),
    };
    if (existingIds.has(fund.product_id)) {
      lines.push(line);
      continue;
    }
    if (newSlots <= 0) {
      continue;
    }
    lines.push(line);
    newSlots -= 1;
  }

  return lines;
}
