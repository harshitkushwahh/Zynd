"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { fetchMfCart, type MfCart } from "@/features/invest/api/invest-api";
import type { FundsForYouResponse } from "@/features/recommendations/types/funds-for-you";
import { useAuth } from "@/contexts/auth-context";
import { queryKeys } from "@/lib/query-keys";

export function getLumpsumCartProductIds(cart: MfCart) {
  return new Set(
    cart.items
      .filter((item) => item.investment_type === "lumpsum")
      .map((item) => item.product_id),
  );
}

export function patchFundsForYouCartFlags(queryClient: QueryClient, cart: MfCart) {
  const cartProductIds = getLumpsumCartProductIds(cart);
  const current = queryClient.getQueryData<FundsForYouResponse>(
    queryKeys.recommendations.fundsForYou(),
  );

  if (!current?.funds.length) return;

  queryClient.setQueryData<FundsForYouResponse>(queryKeys.recommendations.fundsForYou(), {
    ...current,
    funds: current.funds.map((fund) => ({
      ...fund,
      in_cart: cartProductIds.has(fund.product_id),
    })),
  });
}

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

export function syncMfCartQueryData(queryClient: QueryClient, cart: MfCart) {
  void queryClient.cancelQueries({ queryKey: queryKeys.invest.cart() });
  setMfCartQueryData(queryClient, cart);
  patchFundsForYouCartFlags(queryClient, cart);
  void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.fundsForYou() });
}

export function useSyncMfCartCache() {
  const queryClient = useQueryClient();

  return useCallback(
    (cart: MfCart) => {
      syncMfCartQueryData(queryClient, cart);
    },
    [queryClient],
  );
}
