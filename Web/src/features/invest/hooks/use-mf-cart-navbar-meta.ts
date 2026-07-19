"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMfCart, type MfCartItem } from "@/features/invest/api/invest-api";
import { useAuth } from "@/contexts/auth-context";

export const MF_CART_NAVBAR_MAX_LOGOS = 7;

export function isMfCartPath(pathname: string) {
  return pathname.startsWith("/dashboard/mutual-funds/cart");
}

export function useMfCartNavbarMeta(pathname: string) {
  const isCartPage = isMfCartPath(pathname);
  const { user } = useAuth();
  const [items, setItems] = useState<MfCartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isCartPage || !user?.fund_movement_eligible) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const cart = await fetchMfCart();
      setItems(cart.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isCartPage, user?.fund_movement_eligible]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isCartPage) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isCartPage, refresh]);

  const visibleItems = items.slice(0, MF_CART_NAVBAR_MAX_LOGOS);
  const overflowCount = Math.max(items.length - MF_CART_NAVBAR_MAX_LOGOS, 0);

  return {
    isCartPage,
    items,
    visibleItems,
    overflowCount,
    loading,
    totalCount: items.length,
  };
}
