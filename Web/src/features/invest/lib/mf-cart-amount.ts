import type { InvestFundSummary, MfCart } from "@/features/invest/api/invest-api";

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
  cart: Pick<MfCart, "max_items" | "item_count" | "items">,
) {
  const existingIds = new Set(cart.items.map((item) => item.product_id));
  let newSlots = Math.max(cart.max_items - cart.item_count, 0);
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
