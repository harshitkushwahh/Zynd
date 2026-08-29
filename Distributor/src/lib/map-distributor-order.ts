import type { DistributorOrder } from "@/lib/distributor-types";

export function orderVariantId(order: DistributorOrder): string {
  if (order.operationChannel === "sip") return "sip";
  if (order.operationChannel === "redemption" || order.orderType === "Redeem") {
    return "redemption";
  }
  return "one-time";
}

export function filterOrdersByVariant(
  orders: DistributorOrder[],
  variantId?: string,
): DistributorOrder[] {
  if (!variantId) return orders;
  return orders.filter((order) => orderVariantId(order) === variantId);
}
