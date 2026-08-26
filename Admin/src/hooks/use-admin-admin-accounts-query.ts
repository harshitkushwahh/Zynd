"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchAdminAccounts, type AdminAccountListItem } from "@/lib/admin-api";

export function adminAdminAccountsQueryKey(enabled: boolean) {
  return ["admin-admin-accounts", { enabled }] as const;
}

export function useAdminAdminAccountsQuery(enabled: boolean) {
  return useQuery({
    queryKey: adminAdminAccountsQueryKey(enabled),
    queryFn: async (): Promise<AdminAccountListItem[]> => fetchAdminAccounts(),
    enabled,
  });
}
