"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchAdminUserFamilyGroups, type AdminUserFamilyGroups } from "@/lib/family-groups-admin-api";

export function adminUserFamilyGroupsQueryKey(userId: string) {
  return ["admin-user-family-groups", userId] as const;
}

export function useAdminUserFamilyGroupsQuery(userId: string) {
  return useQuery({
    queryKey: adminUserFamilyGroupsQueryKey(userId),
    queryFn: () => fetchAdminUserFamilyGroups(userId),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });
}

export type { AdminUserFamilyGroups };
