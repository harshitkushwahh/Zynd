"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchAdminUserDirectoryMetrics } from "@/lib/admin-api";

export type AdminUserManagementMetricsParams = {
  canReadUsers: boolean;
};

export type AdminUserManagementMetrics = {
  registeredUsers: number;
  kycCompliant: number;
  suspendedAccounts: number;
  activeInvestors: number;
};

export function adminUserManagementMetricsQueryKey(
  params: AdminUserManagementMetricsParams,
) {
  return ["admin-user-management-metrics", { users: params.canReadUsers }] as const;
}

export function useAdminUserManagementMetricsQuery(
  params: AdminUserManagementMetricsParams,
) {
  return useQuery({
    queryKey: adminUserManagementMetricsQueryKey(params),
    queryFn: async (): Promise<AdminUserManagementMetrics> => {
      const metrics = await fetchAdminUserDirectoryMetrics();
      return {
        registeredUsers: metrics.registered_users,
        kycCompliant: metrics.kyc_compliant,
        suspendedAccounts: metrics.suspended_accounts,
        activeInvestors: metrics.active_investors,
      };
    },
    enabled: params.canReadUsers,
  });
}
