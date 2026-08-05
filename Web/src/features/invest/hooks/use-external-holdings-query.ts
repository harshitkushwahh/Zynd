"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchExternalHoldings } from "@/features/invest/api/invest-api";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

export function useExternalHoldingsQuery() {
  const query = useQuery({
    queryKey: queryKeys.invest.externalHoldings(),
    queryFn: fetchExternalHoldings,
    select: (response) => response.external_holdings,
  });

  const holdings = query.data ?? [];
  const errorMessage =
    query.error instanceof Error
      ? query.error.message || copy.dashboard.overview.holdingsLoadError
      : query.error
        ? copy.dashboard.overview.holdingsLoadError
        : null;

  return {
    ...query,
    holdings,
    showSkeleton: query.isPending && !query.data && !query.error,
    errorMessage,
  };
}
