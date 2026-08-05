"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMfSipPlans } from "@/features/invest/api/invest-api";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

export function useMfSipPlansQuery() {
  const query = useQuery({
    queryKey: queryKeys.invest.sipPlans(),
    queryFn: fetchMfSipPlans,
    select: (response) => response.plans,
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

  return {
    ...query,
    plans,
    showSkeleton: query.isPending && !query.data,
    errorMessage,
  };
}
