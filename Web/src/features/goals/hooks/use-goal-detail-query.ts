"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchGoal } from "@/features/goals/api/goals-api";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

function resolveDetailError(error: unknown) {
  if (!(error instanceof Error)) return copy.goals.detailLoadError;
  const message = error.message.trim();
  return message && message !== "Request failed" ? message : copy.goals.detailLoadError;
}

export function useGoalDetailQuery(goalId: string) {
  const query = useQuery({
    queryKey: queryKeys.goals.detail(goalId),
    queryFn: () => fetchGoal(goalId),
    enabled: Boolean(goalId),
  });

  return {
    ...query,
    goal: query.data ?? null,
    showSkeleton: query.isPending && !query.data,
    errorMessage: query.error ? resolveDetailError(query.error) : null,
  };
}
