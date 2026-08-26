"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMfOrders } from "@/features/invest/api/invest-api";
import { portfolioQueryLoadState } from "@/features/dashboard/portfolio/lib/portfolio-query-load-state";
import { keepPreviousQueryData } from "@/lib/query-utils";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

const ORDERS_STALE_MS = 30_000;

export function useMfOrdersQuery(limit = 100) {
  const query = useQuery({
    queryKey: queryKeys.invest.orders(limit),
    queryFn: () => fetchMfOrders(limit),
    select: (response) => response.orders,
    staleTime: ORDERS_STALE_MS,
    placeholderData: keepPreviousQueryData,
    refetchOnMount: (query) => query.state.data === undefined,
  });

  const orders = query.data ?? [];
  const errorMessage =
    query.error instanceof Error
      ? query.error.message || copy.transactions.loadError
      : query.error
        ? copy.transactions.loadError
        : null;

  const loadState = portfolioQueryLoadState(query);

  return {
    ...query,
    orders,
    showSkeleton: loadState.showSkeleton,
    hasResolved: loadState.hasResolved,
    errorMessage,
  };
}
