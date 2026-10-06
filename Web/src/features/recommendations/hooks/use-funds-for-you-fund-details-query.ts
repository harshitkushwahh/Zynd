"use client";

import { useQuery } from "@tanstack/react-query";

import { compareMfFunds } from "@/features/invest/api/invest-api";
import { queryKeys } from "@/lib/query-keys";

const STALE_TIME_MS = 10 * 60 * 1000;

export function useFundsForYouFundDetailsQuery(productIds: readonly string[], enabled = true) {
  const sortedIds = [...productIds].sort();

  return useQuery({
    queryKey: queryKeys.recommendations.fundsForYouFundDetails(sortedIds),
    queryFn: async () => {
      const response = await compareMfFunds(sortedIds);
      return new Map(response.funds.map((fund) => [fund.product_id, fund]));
    },
    enabled: enabled && sortedIds.length > 0,
    staleTime: STALE_TIME_MS,
  });
}
