"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchFundsForYou } from "@/features/recommendations/api/funds-for-you-api";
import { queryKeys } from "@/lib/query-keys";

const STALE_TIME_MS = 5 * 60 * 1000;

export function useFundsForYouQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.recommendations.fundsForYou(),
    queryFn: fetchFundsForYou,
    enabled,
    staleTime: STALE_TIME_MS,
  });
}
