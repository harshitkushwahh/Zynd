"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  fetchPortfolioHoldings,
  fetchPortfolioRedeemUnits,
  fetchPortfolioSummary,
} from "@/features/dashboard/portfolio/lib/portfolio-api";
import { fetchMfOrders, fetchMfSipPlans } from "@/features/invest/api/invest-api";
import { queryKeys } from "@/lib/query-keys";

const PORTFOLIO_ORDERS_LIMIT = 100;

export function usePrefetchPortfolioTabs() {
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.portfolio.summary(),
      queryFn: fetchPortfolioSummary,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.portfolio.holdings(),
      queryFn: fetchPortfolioHoldings,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.invest.sipPlans(),
      queryFn: fetchMfSipPlans,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.portfolio.redeemUnits(),
      queryFn: fetchPortfolioRedeemUnits,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.invest.orders(PORTFOLIO_ORDERS_LIMIT),
      queryFn: () => fetchMfOrders(PORTFOLIO_ORDERS_LIMIT),
    });
  }, [queryClient]);
}
