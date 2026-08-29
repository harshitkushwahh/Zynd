"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchDistributorOrders } from "@/lib/distributor-orders-api";
import type { DistributorOrder } from "@/lib/distributor-types";

type DistributorOrdersContextValue = {
  bookOrders: DistributorOrder[];
  allOrders: DistributorOrder[];
  ordersLoading: boolean;
  refreshOrders: () => Promise<void>;
};

const DistributorOrdersContext = createContext<DistributorOrdersContextValue | null>(null);

export function DistributorOrdersProvider({ children }: { children: ReactNode }) {
  const [bookOrders, setBookOrders] = useState<DistributorOrder[]>([]);
  const [allOrders, setAllOrders] = useState<DistributorOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const refreshOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const [book, all] = await Promise.all([
        fetchDistributorOrders({ scope: "book", limit: 200 }),
        fetchDistributorOrders({ scope: "all", limit: 200 }),
      ]);
      setBookOrders(book);
      setAllOrders(all);
    } catch {
      setBookOrders([]);
      setAllOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const value = useMemo(
    () => ({
      bookOrders,
      allOrders,
      ordersLoading,
      refreshOrders,
    }),
    [allOrders, bookOrders, ordersLoading, refreshOrders],
  );

  return (
    <DistributorOrdersContext.Provider value={value}>{children}</DistributorOrdersContext.Provider>
  );
}

export function useDistributorOrders() {
  const context = useContext(DistributorOrdersContext);
  if (!context) {
    throw new Error("useDistributorOrders must be used within DistributorOrdersProvider");
  }
  return context;
}
