import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export function invalidateInvestQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.invest.all() });
}

export function invalidatePortfolioQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
}

export async function invalidateInvestAndPortfolioQueries(queryClient: QueryClient) {
  await Promise.all([
    invalidateInvestQueries(queryClient),
    invalidatePortfolioQueries(queryClient),
  ]);
}
