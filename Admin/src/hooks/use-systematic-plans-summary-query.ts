"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchMfTransactionMandates } from "@/lib/mf-transactions-admin-api";

export type SystematicPlansSummaryData = {
  total_mandates: number;
  active_mandates: number;
  auth_pending_mandates: number;
};

export const SYSTEMATIC_PLANS_SUMMARY_QUERY_KEY = ["mf-systematic-plans-summary"] as const;

export function useSystematicPlansSummaryQuery(canRead: boolean) {
  return useQuery({
    queryKey: SYSTEMATIC_PLANS_SUMMARY_QUERY_KEY,
    queryFn: async (): Promise<SystematicPlansSummaryData> => {
      const result = await fetchMfTransactionMandates({ limit: 50 });
      return result.summary;
    },
    enabled: canRead,
    placeholderData: keepPreviousData,
  });
}
