import type { MfCart } from "@/features/invest/api/invest-api";

/** Matches backend `zynd_mf_cart_max_items` default — applied separately per cart tab. */
export const MF_CART_MAX_ITEMS = 10;

export type MfCartInvestmentType = "lumpsum" | "sip";

export function getMfCartMaxItems(cart?: Pick<MfCart, "max_items"> | null): number {
  return cart?.max_items ?? MF_CART_MAX_ITEMS;
}

export function mfCartItemKey(
  productId: string,
  investmentType: MfCartInvestmentType = "lumpsum",
): string {
  return `${productId}:${investmentType}`;
}

export function mfCartTypeCount(
  cart: Pick<MfCart, "lumpsum_item_count" | "sip_item_count">,
  investmentType: MfCartInvestmentType,
): number {
  return investmentType === "sip" ? cart.sip_item_count : cart.lumpsum_item_count;
}

export function isMfCartFull(
  cart: Pick<MfCart, "max_items" | "lumpsum_item_count" | "sip_item_count">,
  investmentType: MfCartInvestmentType = "lumpsum",
): boolean {
  return mfCartTypeCount(cart, investmentType) >= cart.max_items;
}

export function mfCartHasItem(
  cart: Pick<MfCart, "items">,
  productId: string,
  investmentType: MfCartInvestmentType = "lumpsum",
): boolean {
  const key = mfCartItemKey(productId, investmentType);
  return cart.items.some((item) => mfCartItemKey(item.product_id, item.investment_type) === key);
}

export function remainingMfCartSlots(
  cart: Pick<MfCart, "max_items" | "lumpsum_item_count" | "sip_item_count">,
  investmentType: MfCartInvestmentType = "lumpsum",
): number {
  return Math.max(cart.max_items - mfCartTypeCount(cart, investmentType), 0);
}

/** Whether a new cart line can be added (updates to an existing line are always allowed). */
export function canAddToMfCart(
  cart: Pick<MfCart, "items" | "max_items" | "lumpsum_item_count" | "sip_item_count">,
  productId: string,
  investmentType: MfCartInvestmentType = "lumpsum",
): boolean {
  if (mfCartHasItem(cart, productId, investmentType)) return true;
  return !isMfCartFull(cart, investmentType);
}

export function filterLumpsumBulkCartAdds<T extends { product_id: string }>(
  cart: Pick<MfCart, "items" | "max_items" | "lumpsum_item_count" | "sip_item_count">,
  funds: T[],
): { addable: T[]; skipped: number } {
  const existingLumpsumIds = new Set(
    cart.items
      .filter((item) => item.investment_type === "lumpsum")
      .map((item) => item.product_id),
  );
  let slots = remainingMfCartSlots(cart, "lumpsum");
  const addable: T[] = [];

  for (const fund of funds) {
    if (existingLumpsumIds.has(fund.product_id)) {
      addable.push(fund);
      continue;
    }
    if (slots <= 0) {
      continue;
    }
    addable.push(fund);
    existingLumpsumIds.add(fund.product_id);
    slots -= 1;
  }

  return { addable, skipped: funds.length - addable.length };
}

export function mfCartTypeLabel(investmentType: MfCartInvestmentType): string {
  return investmentType === "sip" ? "SIP" : "One-time";
}
