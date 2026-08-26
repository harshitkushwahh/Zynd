"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchFamilyGroup } from "@/features/family-groups/api/family-groups-api";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

export function useFamilyGroupQuery(groupId: string | null | undefined) {
  const query = useQuery({
    queryKey: queryKeys.family.detail(groupId ?? ""),
    queryFn: () => fetchFamilyGroup(groupId!),
    enabled: Boolean(groupId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const errorMessage = query.error
    ? resolveFamilyGroupApiError(query.error, copy.familyGroups.errors.pageLoadFailedTitle)
    : "";

  return {
    ...query,
    group: query.data ?? null,
    showSkeleton: Boolean(groupId) && query.isPending && !query.data,
    errorMessage,
  };
}
