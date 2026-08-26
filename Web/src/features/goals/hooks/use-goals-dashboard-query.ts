"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";

import { fetchFamilyGroups } from "@/features/family-groups/api/family-groups-api";
import { fetchGoalTemplates, fetchMyGoals } from "@/features/goals/api/goals-api";
import { buildDashboardFamilyGoals } from "@/features/goals/lib/goal-family-goals";
import { keepPreviousQueryData } from "@/lib/query-utils";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

const GOALS_DASHBOARD_STALE_MS = 30_000;

function resolveGoalsError(error: unknown) {
  if (!(error instanceof Error)) return copy.goals.loadError;
  const message = error.message.trim();
  return message && message !== "Request failed" ? message : copy.goals.loadError;
}

export function useGoalsDashboardQuery() {
  const queryClient = useQueryClient();

  const [goalsQuery, templatesQuery, familyGoalsQuery] = useQueries({
    queries: [
      {
        queryKey: queryKeys.goals.me(true),
        queryFn: () => fetchMyGoals(true),
        staleTime: GOALS_DASHBOARD_STALE_MS,
        placeholderData: keepPreviousQueryData,
        refetchOnMount: (query) => query.state.data === undefined,
      },
      {
        queryKey: queryKeys.goals.templates(),
        queryFn: fetchGoalTemplates,
        staleTime: GOALS_DASHBOARD_STALE_MS,
        placeholderData: keepPreviousQueryData,
        refetchOnMount: (query) => query.state.data === undefined,
      },
      {
        queryKey: queryKeys.goals.familyDashboard(),
        queryFn: async () => {
          const groupsResponse = await queryClient.ensureQueryData({
            queryKey: queryKeys.family.list(),
            queryFn: fetchFamilyGroups,
          });
          return buildDashboardFamilyGoals(groupsResponse.items);
        },
        staleTime: GOALS_DASHBOARD_STALE_MS,
        placeholderData: keepPreviousQueryData,
        refetchOnMount: (query) => query.state.data === undefined,
      },
    ],
  });

  const isPending =
    goalsQuery.isPending || templatesQuery.isPending || familyGoalsQuery.isPending;
  const isFetching =
    goalsQuery.isFetching || templatesQuery.isFetching || familyGoalsQuery.isFetching;
  const hasData = Boolean(goalsQuery.data || templatesQuery.data || familyGoalsQuery.data);
  const firstError = goalsQuery.error || templatesQuery.error || familyGoalsQuery.error;

  return {
    goals: goalsQuery.data?.items ?? [],
    templates: templatesQuery.data?.items ?? [],
    familyGoals: familyGoalsQuery.data ?? [],
    showSkeleton: isPending && !hasData,
    hasResolved: !isPending || hasData,
    errorMessage: firstError && !hasData ? resolveGoalsError(firstError) : null,
    isFetching,
    isPending,
    refetch: async () => {
      await Promise.all([
        goalsQuery.refetch(),
        templatesQuery.refetch(),
        familyGoalsQuery.refetch(),
      ]);
    },
    refetchFamilyGoals: () => familyGoalsQuery.refetch(),
  };
}
