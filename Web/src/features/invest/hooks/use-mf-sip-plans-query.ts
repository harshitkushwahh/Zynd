"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMfSipPlans } from "@/features/invest/api/invest-api";
import { portfolioQueryLoadState } from "@/features/dashboard/portfolio/lib/portfolio-query-load-state";
import { keepPreviousQueryData } from "@/lib/query-utils";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

const SIP_PLANS_STALE_MS = 30_000;

export function useMfSipPlansQuery() {
  const query = useQuery({
    queryKey: queryKeys.invest.sipPlans(),
    queryFn: fetchMfSipPlans,
    select: (response) => response.plans,
    staleTime: SIP_PLANS_STALE_MS,
    placeholderData: keepPreviousQueryData,
    refetchOnMount: (query) => query.state.data === undefined,
  });

  const plans = query.data ?? [];
  const errorMessage =
    query.error instanceof Error
      ? (() => {
          const message = query.error.message.trim();
          return message && message !== "Request failed" ? message : copy.mySips.loadError;
        })()
      : query.error
        ? copy.mySips.loadError
        : null;

  const loadState = portfolioQueryLoadState(query);

  return {
    ...query,
    plans,
    showSkeleton: loadState.showSkeleton,
    hasResolved: loadState.hasResolved,
    errorMessage,
  };
}
