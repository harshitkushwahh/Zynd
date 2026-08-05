"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchAdminUserGoals, type AdminUserGoal } from "@/lib/admin-api";

export function adminUserGoalsQueryKey(userRef: string) {
  return ["admin-user-goals", userRef] as const;
}

export function useAdminUserGoalsQuery(userRef: string) {
  return useQuery({
    queryKey: adminUserGoalsQueryKey(userRef),
    queryFn: async () => {
      const result = await fetchAdminUserGoals(userRef);
      return result.items;
    },
    enabled: Boolean(userRef),
    placeholderData: keepPreviousData,
  });
}

export type { AdminUserGoal };
