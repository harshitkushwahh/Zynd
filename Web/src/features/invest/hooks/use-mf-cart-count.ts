"use client";

import { useMfCartQuery } from "@/features/invest/hooks/use-mf-cart-query";

export function useMfCartCount(enabled = true) {
  const query = useMfCartQuery(enabled);

  return {
    itemCount: query.data?.item_count ?? 0,
    loading: query.isPending && !query.data,
    refresh: () => query.refetch(),
  };
}
