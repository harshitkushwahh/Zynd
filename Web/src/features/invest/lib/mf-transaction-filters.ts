import type { MfOrder } from "@/features/invest/api/invest-api";

export type MfTransactionTypeFilter = "all" | "lumpsum" | "sip" | "redemption";
export type MfTransactionStatusFilter = "all" | "processing" | "completed" | "failed";

export type MfTransactionFilters = {
  type: MfTransactionTypeFilter;
  status: MfTransactionStatusFilter;
};

export const EMPTY_MF_TRANSACTION_FILTERS: MfTransactionFilters = {
  type: "all",
  status: "all",
};

export function hasActiveMfTransactionFilters(filters: MfTransactionFilters) {
  return filters.type !== "all" || filters.status !== "all";
}

function normalizeOrderType(orderType: string) {
  return orderType.trim().toUpperCase();
}

export function matchesTransactionType(order: MfOrder, filter: MfTransactionTypeFilter) {
  if (filter === "all") return true;
  const type = normalizeOrderType(order.order_type);
  if (filter === "lumpsum") return type === "LUMPSUM";
  if (filter === "sip") return type === "SIP";
  if (filter === "redemption") return type === "REDEMPTION";
  return true;
}

export function matchesTransactionStatus(order: MfOrder, filter: MfTransactionStatusFilter) {
  if (filter === "all") return true;
  const status = order.status.trim().toUpperCase();
  if (filter === "completed") return status === "SUCCEEDED";
  if (filter === "failed") return status === "FAILED" || status === "CANCELLED";
  if (filter === "processing") {
    return !["SUCCEEDED", "FAILED", "CANCELLED"].includes(status);
  }
  return true;
}

export function applyMfTransactionFilters(orders: MfOrder[], filters: MfTransactionFilters) {
  return orders.filter((order) => {
    if (!matchesTransactionType(order, filters.type)) return false;
    if (!matchesTransactionStatus(order, filters.status)) return false;
    return true;
  });
}

export function sortMfTransactions(orders: MfOrder[]) {
  return [...orders].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}

function normalizeOrderStatus(status: string) {
  return status.trim().toUpperCase();
}

export function isAwaitingAllotmentOrder(order: MfOrder) {
  const status = normalizeOrderStatus(order.status);
  if (status === "SUBMITTED") return true;
  if (status === "PROCESSING" && order.fp_state?.toLowerCase() === "submitted") return true;
  return false;
}

export function isUpcomingHoldingOrder(order: MfOrder) {
  const orderType = normalizeOrderType(order.order_type);
  if (orderType === "REDEMPTION") return false;

  const status = normalizeOrderStatus(order.status);
  if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(status)) return false;
  if (isAwaitingAllotmentOrder(order)) return true;
  return ["PENDING", "PROCESSING", "PAYMENT_PENDING"].includes(status);
}

export function getUpcomingHoldingOrders(orders: MfOrder[]) {
  return sortMfTransactions(orders.filter(isUpcomingHoldingOrder));
}

export function sumUpcomingHoldingOrdersInr(orders: MfOrder[]) {
  return getUpcomingHoldingOrders(orders).reduce((total, order) => total + (order.amount_inr ?? 0), 0);
}
