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
const SUCCEEDED_ORDER_STATUSES = new Set(["succeeded"]);
const FAILED_ORDER_STATUSES = new Set(["failed", "cancelled"]);
const PENDING_SIP_STATUSES = new Set(["PENDING", "REVIEW", "CONSENT_PENDING"]);
const ACTIVE_SIP_STATUSES = new Set(["ACTIVE"]);
const FAILED_SIP_STATUSES = new Set(["FAILED", "CANCELLED"]);

export type OrdersSummaryData = {
  purchases: {
    total: number;
    pending: number;
    succeeded: number;
    failed: number;
  };
  sips: {
    total: number;
    pending: number;
    active: number;
    failed: number;
  };
};

export const ORDERS_SUMMARY_QUERY_KEY = ["mf-orders-summary"] as const;

export function useOrdersSummaryQuery(canRead: boolean) {
  return useQuery({
    queryKey: ORDERS_SUMMARY_QUERY_KEY,
    queryFn: async (): Promise<OrdersSummaryData> => {
      const [ordersResult, plansResult] = await Promise.all([
        fetchMfTransactionOrders({ limit: 50 }),
        fetchMfTransactionSipPlans({ limit: 50 }),
      ]);

      const orders = ordersResult.orders;
      const plans = plansResult.plans;

      return {
        purchases: {
          total: orders.length,
          pending: orders.filter((item) =>
            PENDING_ORDER_STATUSES.has(item.status.toLowerCase()),
          ).length,
          succeeded: orders.filter((item) =>
            SUCCEEDED_ORDER_STATUSES.has(item.status.toLowerCase()),
          ).length,
          failed: orders.filter((item) =>
            FAILED_ORDER_STATUSES.has(item.status.toLowerCase()),
          ).length,
        },
        sips: {
          total: plans.length,
          pending: plans.filter((item) =>
            PENDING_SIP_STATUSES.has(item.status.toUpperCase()),
          ).length,
          active: plans.filter((item) =>
            ACTIVE_SIP_STATUSES.has(item.status.toUpperCase()),
          ).length,
          failed: plans.filter((item) =>
            FAILED_SIP_STATUSES.has(item.status.toUpperCase()),
          ).length,
        },
      };
    },
    enabled: canRead,
    placeholderData: keepPreviousData,
  });
}
