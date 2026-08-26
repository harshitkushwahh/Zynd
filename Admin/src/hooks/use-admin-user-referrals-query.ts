"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchAdminUserReferrals, type AdminUserReferrals } from "@/lib/referrals-admin-api";

export function adminUserReferralsQueryKey(userId: string) {
  return ["admin-user-referrals", userId] as const;
}

export function useAdminUserReferralsQuery(userId: string) {
  return useQuery({
    queryKey: adminUserReferralsQueryKey(userId),
    queryFn: () => fetchAdminUserReferrals(userId),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });
}

export type { AdminUserReferrals };
