"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchFamilyGroups } from "@/features/family-groups/api/family-groups-api";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

export function useFamilyGroupsQuery() {
  const query = useQuery({
    queryKey: queryKeys.family.list(),
    queryFn: fetchFamilyGroups,
  });

  const errorMessage = query.error
    ? resolveFamilyGroupApiError(query.error, copy.familyGroups.errors.pageLoadFailedTitle)
    : "";

  return {
    ...query,
    data: query.data ?? null,
    showSkeleton: query.isPending && !query.data,
    errorMessage,
  };
}
