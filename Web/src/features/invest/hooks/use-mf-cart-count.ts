"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchMfCart } from "@/features/invest/api/invest-api";
import { useAuth } from "@/contexts/auth-context";

export function useMfCartCount(enabled = true) {
  const { user } = useAuth();
  const [itemCount, setItemCount] = useState(0);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled || !user?.fund_movement_eligible) {
      setItemCount(0);
      setLoading(false);
      return;
    }

    try {
      const cart = await fetchMfCart();
      setItemCount(cart.item_count);
    } catch {
      setItemCount(0);
    } finally {
      setLoading(false);
    }
  }, [enabled, user?.fund_movement_eligible]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, refresh]);

  return { itemCount, loading, refresh };
}
