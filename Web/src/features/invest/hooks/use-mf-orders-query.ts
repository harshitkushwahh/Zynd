"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMfOrders } from "@/features/invest/api/invest-api";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

export function useMfOrdersQuery(limit = 100) {
  const query = useQuery({
    queryKey: queryKeys.invest.orders(limit),
    queryFn: () => fetchMfOrders(limit),
    select: (response) => response.orders,
  });

  const orders = query.data ?? [];
  const errorMessage =
    query.error instanceof Error
      ? query.error.message || copy.transactions.loadError
      : query.error
        ? copy.transactions.loadError
        : null;

  return {
    ...query,
    orders,
    showSkeleton: query.isPending && !query.data && !query.error,
    errorMessage,
  };
}
