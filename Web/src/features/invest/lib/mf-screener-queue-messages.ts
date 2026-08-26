import { copy } from "@/shared/config/copy";
import { MF_CART_MAX_ITEMS } from "@/features/invest/lib/mf-cart-limits";

export function screenerQueueFullMessage(
  count: number,
  max: number = MF_CART_MAX_ITEMS,
): string {
  return copy.mutualFunds.screenerQueueFull
    .replace("{count}", String(count))
    .replace("{max}", String(max));
}

export function screenerQueuePartialMessage(
  count: number,
  remaining: number,
  max: number = MF_CART_MAX_ITEMS,
): string {
  return copy.mutualFunds.screenerQueuePartial
    .replace("{count}", String(count))
    .replace("{remaining}", String(remaining))
    .replace("{max}", String(max));
}

export function screenerQueueRejectMessage(count: number, max: number = MF_CART_MAX_ITEMS): string {
  if (count >= max) {
    return screenerQueueFullMessage(count, max);
  }
  return screenerQueuePartialMessage(count, Math.max(max - count, 0), max);
}

export function screenerCartPartialAddMessage(cartCount: number, remaining: number): string {
  return copy.mutualFunds.screenerCartAddPartial
    .replace("{count}", String(cartCount))
    .replace("{remaining}", String(remaining));
}

export function screenerCartBlockedMessage(cartCount: number, max: number): string {
  return copy.mutualFunds.screenerCartAddBlocked
    .replace("{count}", String(cartCount))
    .replace("{max}", String(max));
}

export function cartTypeFullMessage(
  investmentType: "lumpsum" | "sip",
  max: number,
): string {
  const typeLabel = investmentType === "sip" ? "SIP" : "One-time";
  return copy.mutualFunds.cartTypeFullHint
    .replace("{type}", typeLabel)
    .replace("{max}", String(max));
}
