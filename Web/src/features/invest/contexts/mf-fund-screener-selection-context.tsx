"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import type { MfFundScreenerDragPayload } from "@/features/invest/lib/mf-fund-screener-drag";
import { resolveScreenerCartLumpsumAmount } from "@/features/invest/lib/mf-cart-amount";
import { MF_CART_MAX_ITEMS } from "@/features/invest/lib/mf-cart-limits";

export type MfFundScreenerSelectionItem = MfFundScreenerDragPayload & {
  amount_inr: number;
};

export type ScreenerQueueAddResult = "added" | "duplicate" | "full";

type MfFundScreenerSelectionContextValue = {
  selectedFunds: MfFundScreenerSelectionItem[];
  maxSelectableFunds: number;
  selectionCount: number;
  remainingSelectionSlots: number;
  isSelectionFull: boolean;
  isSelected: (productId: string) => boolean;
  toggleFund: (fund: InvestFundSummary | MfFundScreenerSelectionItem) => ScreenerQueueAddResult;
  addFund: (fund: InvestFundSummary | MfFundScreenerSelectionItem) => ScreenerQueueAddResult;
  removeFund: (productId: string) => void;
  clearSelection: () => void;
};

const MfFundScreenerSelectionContext =
  createContext<MfFundScreenerSelectionContextValue | null>(null);

export function toMfFundScreenerSelectionItem(
  fund: InvestFundSummary | MfFundScreenerSelectionItem,
): MfFundScreenerSelectionItem {
  return {
    product_id: fund.product_id,
    name: fund.name,
    min_lumpsum_amount_inr: fund.min_lumpsum_amount_inr ?? null,
    amc_name: fund.amc_name,
    amc_slug: fund.amc_slug,
    amc_logo_url: fund.amc_logo_url ?? null,
    amount_inr: resolveScreenerCartLumpsumAmount(fund.min_lumpsum_amount_inr),
  };
}

export function MfFundScreenerSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedById, setSelectedById] = useState<
    Record<string, MfFundScreenerSelectionItem>
  >({});

  const selectedFunds = useMemo(() => Object.values(selectedById), [selectedById]);
  const selectionCount = selectedFunds.length;
  const remainingSelectionSlots = Math.max(MF_CART_MAX_ITEMS - selectionCount, 0);
  const isSelectionFull = remainingSelectionSlots === 0;

  const isSelected = useCallback(
    (productId: string) => Boolean(selectedById[productId]),
    [selectedById],
  );

  const addFund = useCallback((fund: InvestFundSummary | MfFundScreenerSelectionItem): ScreenerQueueAddResult => {
    const item = toMfFundScreenerSelectionItem(fund);
    let result: ScreenerQueueAddResult = "full";

    setSelectedById((current) => {
      if (current[item.product_id]) {
        result = "duplicate";
        return current;
      }
      if (Object.keys(current).length >= MF_CART_MAX_ITEMS) {
        result = "full";
        return current;
      }
      result = "added";
      return { ...current, [item.product_id]: item };
    });

    return result;
  }, []);

  const removeFund = useCallback((productId: string) => {
    setSelectedById((current) => {
      if (!current[productId]) return current;
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }, []);

  const toggleFund = useCallback(
    (fund: InvestFundSummary | MfFundScreenerSelectionItem): ScreenerQueueAddResult => {
      const productId = fund.product_id;
      let result: ScreenerQueueAddResult = "full";

      setSelectedById((current) => {
        if (current[productId]) {
          const next = { ...current };
          delete next[productId];
          result = "added";
          return next;
        }
        if (Object.keys(current).length >= MF_CART_MAX_ITEMS) {
          result = "full";
          return current;
        }
        result = "added";
        return { ...current, [productId]: toMfFundScreenerSelectionItem(fund) };
      });

      return result;
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedById({});
  }, []);

  const value = useMemo(
    () => ({
      selectedFunds,
      maxSelectableFunds: MF_CART_MAX_ITEMS,
      selectionCount,
      remainingSelectionSlots,
      isSelectionFull,
      isSelected,
      toggleFund,
      addFund,
      removeFund,
      clearSelection,
    }),
    [
      addFund,
      clearSelection,
      isSelected,
      isSelectionFull,
      remainingSelectionSlots,
      removeFund,
      selectedFunds,
      selectionCount,
      toggleFund,
    ],
  );

  return (
    <MfFundScreenerSelectionContext.Provider value={value}>
      {children}
    </MfFundScreenerSelectionContext.Provider>
  );
}

export function useMfFundScreenerSelection() {
  const context = useContext(MfFundScreenerSelectionContext);
  if (!context) {
    throw new Error(
      "useMfFundScreenerSelection must be used within MfFundScreenerSelectionProvider",
    );
  }
  return context;
}

export function useMfFundScreenerSelectionOptional() {
  return useContext(MfFundScreenerSelectionContext);
}
