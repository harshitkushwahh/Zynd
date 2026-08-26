"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchInvestHome } from "@/features/invest/api/invest-api";
import { keepPreviousQueryData } from "@/lib/query-utils";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

const INVEST_HOME_STALE_MS = 30_000;

export function useInvestHomeQuery() {
  const query = useQuery({
    queryKey: queryKeys.invest.home(),
    queryFn: fetchInvestHome,
    staleTime: INVEST_HOME_STALE_MS,
    placeholderData: keepPreviousQueryData,
  });

  const errorMessage =
    query.error instanceof Error
      ? query.error.message || copy.mutualFunds.catalogLoadError
      : query.error
        ? copy.mutualFunds.catalogLoadError
        : null;

  return {
    ...query,
    homeData: query.data ?? null,
    showSkeleton: query.isPending && !query.data,
    errorMessage,
  };
}
