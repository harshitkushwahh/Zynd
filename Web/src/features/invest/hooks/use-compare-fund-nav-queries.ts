"use client";

import { useQueries } from "@tanstack/react-query";

import { fetchInvestFundNavs, type InvestFundDetail } from "@/features/invest/api/invest-api";
import { queryKeys } from "@/lib/query-keys";

const COMPARE_NAV_HISTORY_LIMIT = 2000;

export function useCompareFundNavQueries(funds: InvestFundDetail[]) {
  const queries = useQueries({
    queries: funds.map((fund) => ({
      queryKey: queryKeys.invest.fundNavs(fund.product_id, COMPARE_NAV_HISTORY_LIMIT),
      queryFn: () => fetchInvestFundNavs(fund.product_id, COMPARE_NAV_HISTORY_LIMIT),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = queries.some((query) => query.isLoading);
  const isFetching = queries.some((query) => query.isFetching);

  const series = funds.map((fund, index) => ({
    fund,
    navPoints: queries[index]?.data?.points ?? [],
    error: queries[index]?.error,
  }));

  return { series, isLoading, isFetching };
}
