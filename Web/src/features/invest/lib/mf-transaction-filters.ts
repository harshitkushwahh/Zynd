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
