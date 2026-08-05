"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  fetchMfTransactionCheckouts,
  fetchMfTransactionSipBatches,
} from "@/lib/mf-transactions-admin-api";

const PENDING_CHECKOUT_STATUSES = new Set([
  "PENDING",
  "PAYMENT_PENDING",
  "SUBMITTED",
  "PROCESSING",
]);
const FAILED_CHECKOUT_STATUSES = new Set(["FAILED", "CANCELLED"]);
const PENDING_MANDATE_STATUSES = new Set(["PENDING", "AUTH_PENDING"]);
const FAILED_MANDATE_STATUSES = new Set(["FAILED", "CANCELLED"]);

export type BulkOrderSummaryData = {
  lumpsumCount: number;
  sipCount: number;
  pendingCount: number;
  failedCount: number;
};

export const BULK_ORDER_SUMMARY_QUERY_KEY = ["mf-bulk-order-summary"] as const;

export function useBulkOrderSummaryQuery(canRead: boolean) {
  return useQuery({
    queryKey: BULK_ORDER_SUMMARY_QUERY_KEY,
    queryFn: async (): Promise<BulkOrderSummaryData> => {
      const [checkoutsResult, batchesResult] = await Promise.all([
        fetchMfTransactionCheckouts({ checkout_type: "CART", limit: 50 }),
        fetchMfTransactionSipBatches({ limit: 50 }),
      ]);

      const checkouts = checkoutsResult.checkouts;
      const batches = batchesResult.batches;

      return {
        lumpsumCount: checkouts.length,
        sipCount: batches.length,
        pendingCount:
          checkouts.filter((item) => PENDING_CHECKOUT_STATUSES.has(item.status.toUpperCase()))
            .length +
          batches.filter((item) =>
            PENDING_MANDATE_STATUSES.has(item.mandate_status.toUpperCase()),
          ).length,
        failedCount:
          checkouts.filter((item) => FAILED_CHECKOUT_STATUSES.has(item.status.toUpperCase()))
            .length +
          batches.filter((item) =>
            FAILED_MANDATE_STATUSES.has(item.mandate_status.toUpperCase()),
          ).length,
      };
    },
    enabled: canRead,
    placeholderData: keepPreviousData,
  });
}
