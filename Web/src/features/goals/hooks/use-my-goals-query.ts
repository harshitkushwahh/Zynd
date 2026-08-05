"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchMyGoals } from "@/features/goals/api/goals-api";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

function resolveGoalsError(error: unknown) {
  if (!(error instanceof Error)) return copy.goals.loadError;
  const message = error.message.trim();
  return message && message !== "Request failed" ? message : copy.goals.loadError;
}

/** Shared goals list (includes archived) — used by goals pages + overview. */
export function useMyGoalsQuery(includeArchived = true) {
  const query = useQuery({
    queryKey: queryKeys.goals.me(includeArchived),
    queryFn: () => fetchMyGoals(includeArchived),
    select: (response) => response.items,
  });

  const goals = query.data ?? [];

  return {
    ...query,
    goals,
    showSkeleton: query.isPending && !query.data,
    errorMessage: query.error ? resolveGoalsError(query.error) : null,
    hasResolved: !query.isPending || query.isFetched,
  };
}
