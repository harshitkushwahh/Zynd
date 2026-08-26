"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMfOrder } from "@/features/invest/api/invest-api";
import { portfolioQueryLoadState } from "@/features/dashboard/portfolio/lib/portfolio-query-load-state";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

export function useMfOrderQuery(orderId: string, enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.invest.order(orderId),
    queryFn: () => fetchMfOrder(orderId),
    enabled: enabled && Boolean(orderId),
  });

  const errorMessage =
    query.error instanceof Error
      ? query.error.message || copy.transactions.loadError
      : query.error
        ? copy.transactions.loadError
        : null;

  const loadState = portfolioQueryLoadState(query);

  return {
    ...query,
    order: query.data ?? null,
    showSkeleton: loadState.showSkeleton,
    hasResolved: loadState.hasResolved,
    errorMessage,
  };
}
