"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchFamilyGroups } from "@/features/family-groups/api/family-groups-api";
import { buildDashboardFamilyGoals } from "@/features/goals/lib/goal-family-goals";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

function resolveGoalsError(error: unknown) {
  if (!(error instanceof Error)) return copy.goals.loadError;
  const message = error.message.trim();
  return message && message !== "Request failed" ? message : copy.goals.loadError;
}

export function useDashboardFamilyGoalsQuery() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.goals.familyDashboard(),
    queryFn: async () => {
      const groupsResponse = await queryClient.ensureQueryData({
        queryKey: queryKeys.family.list(),
        queryFn: fetchFamilyGroups,
      });
      return buildDashboardFamilyGoals(groupsResponse.items);
    },
  });

  return {
    ...query,
    familyGoals: query.data ?? [],
    showSkeleton: query.isPending && !query.data,
    errorMessage: query.error ? resolveGoalsError(query.error) : null,
    hasResolved: !query.isPending || query.isFetched,
  };
}
