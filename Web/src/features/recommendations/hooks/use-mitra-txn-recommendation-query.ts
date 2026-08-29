"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMitraTxnRecommendation } from "@/features/recommendations/api/mitra-txn-recommendation-api";
import { queryKeys } from "@/lib/query-keys";

const STALE_TIME_MS = 60 * 1000;

export function useMitraTxnRecommendationQuery(token: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.recommendations.mitraTxnRecommendation(token),
    queryFn: () => fetchMitraTxnRecommendation(token),
    enabled: enabled && Boolean(token),
    staleTime: STALE_TIME_MS,
    retry: false,
  });
}
