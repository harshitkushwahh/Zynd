"use client";

import { useMfCartQuery } from "@/features/invest/hooks/use-mf-cart-query";

export const MF_CART_NAVBAR_MAX_LOGOS = 7;

export function isMfCartPath(pathname: string) {
  return pathname.startsWith("/dashboard/mutual-funds/cart");
}

export function useMfCartNavbarMeta(pathname: string) {
  const isCartPage = isMfCartPath(pathname);
  const query = useMfCartQuery();
  const items = isCartPage ? (query.data?.items ?? []) : [];
  const visibleItems = items.slice(0, MF_CART_NAVBAR_MAX_LOGOS);
  const overflowCount = Math.max(items.length - MF_CART_NAVBAR_MAX_LOGOS, 0);

  return {
    isCartPage,
    items,
    visibleItems,
    overflowCount,
    loading: isCartPage && query.isPending && !query.data,
    totalCount: items.length,
  };
}
