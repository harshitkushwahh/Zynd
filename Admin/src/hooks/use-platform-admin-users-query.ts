"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchAdminUsers, type AdminUserListItem } from "@/lib/admin-api";

export function platformAdminUsersQueryKey() {
  return ["platform-admin-users"] as const;
}

export function usePlatformAdminUsersQuery(enabled = true) {
  return useQuery({
    queryKey: platformAdminUsersQueryKey(),
    queryFn: async (): Promise<AdminUserListItem[]> => {
      return fetchAdminUsers({ role: "admin", limit: 200 });
    },
    enabled,
    staleTime: 60_000,
  });
}
