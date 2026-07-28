"use client";

import { useMyGoalsQuery } from "@/features/goals/hooks/use-my-goals-query";

export function useCachedPersonalGoalsList() {
  const { goals, showSkeleton, errorMessage, hasResolved, refetch, isPending } = useMyGoalsQuery(true);

  return {
    goals,
    loading: isPending && !goals.length,
    hasResolved,
    error: errorMessage,
    showSkeleton,
    reload: () => refetch(),
  };
}
