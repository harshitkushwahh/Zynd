"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { fetchMfCart, type MfCart } from "@/features/invest/api/invest-api";
import { useAuth } from "@/contexts/auth-context";
import { queryKeys } from "@/lib/query-keys";

export function useMfCartQuery(enabled = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.invest.cart(),
    queryFn: fetchMfCart,
    enabled: enabled && Boolean(user?.fund_movement_eligible),
  });
}

export function setMfCartQueryData(queryClient: QueryClient, cart: MfCart) {
  queryClient.setQueryData(queryKeys.invest.cart(), cart);
}

export function useSyncMfCartCache() {
  const queryClient = useQueryClient();

  return useCallback(
    (cart: MfCart) => {
      setMfCartQueryData(queryClient, cart);
    },
    [queryClient],
  );
}
