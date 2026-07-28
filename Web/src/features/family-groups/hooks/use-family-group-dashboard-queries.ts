"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchFamilyGroupActivity,
  fetchFamilyGroupGoals,
  fetchFamilyGroupPortfolio,
} from "@/features/family-groups/api/family-groups-api";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

export function useFamilyGroupPortfolioQuery(groupId: string | null | undefined) {
  const dashboard = copy.familyGroups.dashboard;
  const query = useQuery({
    queryKey: queryKeys.family.portfolio(groupId ?? ""),
    queryFn: () => fetchFamilyGroupPortfolio(groupId!),
    enabled: Boolean(groupId),
  });

  return {
    ...query,
    portfolio: query.data ?? null,
    showSkeleton: Boolean(groupId) && query.isPending && !query.data,
    errorMessage: query.error
      ? resolveFamilyGroupApiError(query.error, dashboard.portfolioLoadFailed)
      : "",
  };
}

export function useFamilyGroupGoalsQuery(groupId: string | null | undefined) {
  const dashboard = copy.familyGroups.dashboard;
  const query = useQuery({
    queryKey: queryKeys.family.goals(groupId ?? ""),
    queryFn: async () => {
      const response = await fetchFamilyGroupGoals(groupId!);
      return response.items;
    },
    enabled: Boolean(groupId),
  });

  return {
    ...query,
    goals: query.data ?? [],
    showSkeleton: Boolean(groupId) && query.isPending && !query.data,
    errorMessage: query.error
      ? resolveFamilyGroupApiError(query.error, dashboard.goalsLoadFailed)
      : "",
  };
}

export function useFamilyGroupActivityQuery(
  groupId: string | null | undefined,
  limit: number,
) {
  const query = useQuery({
    queryKey: queryKeys.family.activity(groupId ?? "", limit),
    queryFn: async () => {
      const response = await fetchFamilyGroupActivity(groupId!, { limit });
      return response.items;
    },
    enabled: Boolean(groupId),
  });

  return {
    ...query,
    items: query.data ?? [],
    showSkeleton: Boolean(groupId) && query.isPending && !query.data,
    errorMessage: query.error
      ? resolveFamilyGroupApiError(query.error, copy.familyGroups.activity.loadFailedTitle)
      : "",
  };
}
