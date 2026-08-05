"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  fetchMfTransactionOrders,
  fetchMfTransactionSipPlans,
} from "@/lib/mf-transactions-admin-api";

const PENDING_ORDER_STATUSES = new Set([
  "pending",
  "submitted",
  "payment_pending",
  "processing",
]);
const FAILED_ORDER_STATUSES = new Set(["failed", "cancelled"]);
const PENDING_SIP_STATUSES = new Set(["PENDING", "REVIEW", "CONSENT_PENDING"]);
const FAILED_SIP_STATUSES = new Set(["FAILED", "CANCELLED"]);

export type TxnRequestsSummaryData = {
  lumpsumCount: number;
  sipCount: number;
  pendingCount: number;
  failedCount: number;
};

export const TXN_REQUESTS_SUMMARY_QUERY_KEY = ["mf-txn-requests-summary"] as const;

export function useTxnRequestsSummaryQuery(canRead: boolean) {
  return useQuery({
    queryKey: TXN_REQUESTS_SUMMARY_QUERY_KEY,
    queryFn: async (): Promise<TxnRequestsSummaryData> => {
      const [ordersResult, plansResult] = await Promise.all([
        fetchMfTransactionOrders({
          order_type: "LUMPSUM",
          checkout_type: "SINGLE",
          limit: 50,
        }),
        fetchMfTransactionSipPlans({ limit: 50 }),
      ]);

      const orders = ordersResult.orders;
      const plans = plansResult.plans;

      return {
        lumpsumCount: orders.length,
        sipCount: plans.length,
        pendingCount:
          orders.filter((item) => PENDING_ORDER_STATUSES.has(item.status.toLowerCase())).length +
          plans.filter((item) => PENDING_SIP_STATUSES.has(item.status.toUpperCase())).length,
        failedCount:
          orders.filter((item) => FAILED_ORDER_STATUSES.has(item.status.toLowerCase())).length +
          plans.filter((item) => FAILED_SIP_STATUSES.has(item.status.toUpperCase())).length,
      };
    },
    enabled: canRead,
    placeholderData: keepPreviousData,
  });
}
