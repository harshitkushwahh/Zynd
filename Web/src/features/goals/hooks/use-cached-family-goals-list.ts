"use client";

import { useDashboardFamilyGoalsQuery } from "@/features/goals/hooks/use-dashboard-family-goals-query";

export function useCachedFamilyGoalsList() {
  const { familyGoals, showSkeleton, errorMessage, hasResolved, refetch, isPending } =
    useDashboardFamilyGoalsQuery();

  return {
    familyGoals,
    loading: isPending && familyGoals.length === 0,
    hasResolved,
    error: errorMessage,
    showSkeleton,
    reload: () => refetch(),
  };
}
