"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchAdminActions,
  fetchAdminUsers,
  fetchPendingDeletions,
  fetchSecurityReviews,
} from "@/lib/admin-api";

export type AdminUserManagementMetricsParams = {
  canReadUsers: boolean;
  canReadReviews: boolean;
  canExecuteDeletions: boolean;
  canApproveActions: boolean;
};

export type AdminUserManagementMetrics = {
  registeredUsers: number;
  openReviews: number;
  pendingDeletions: number;
  pendingActions: number;
};

export function adminUserManagementMetricsQueryKey(
  params: AdminUserManagementMetricsParams,
) {
  return [
    "admin-user-management-metrics",
    {
      users: params.canReadUsers,
      reviews: params.canReadReviews,
      deletions: params.canExecuteDeletions,
      actions: params.canApproveActions,
    },
  ] as const;
}

export function useAdminUserManagementMetricsQuery(
  params: AdminUserManagementMetricsParams,
) {
  const enabled =
    params.canReadUsers ||
    params.canReadReviews ||
    params.canExecuteDeletions ||
    params.canApproveActions;

  return useQuery({
    queryKey: adminUserManagementMetricsQueryKey(params),
    queryFn: async (): Promise<AdminUserManagementMetrics> => {
      const metrics: AdminUserManagementMetrics = {
        registeredUsers: 0,
        openReviews: 0,
        pendingDeletions: 0,
        pendingActions: 0,
      };

      const tasks: Promise<unknown>[] = [];

      if (params.canReadUsers) {
        tasks.push(
          fetchAdminUsers({ limit: 100 }).then((items) => {
            metrics.registeredUsers = items.length;
          }),
        );
      }
      if (params.canReadReviews) {
        tasks.push(
          fetchSecurityReviews("open").then((items) => {
            metrics.openReviews = items.length;
          }),
        );
      }
      if (params.canExecuteDeletions) {
        tasks.push(
          fetchPendingDeletions().then((items) => {
            metrics.pendingDeletions = items.length;
          }),
        );
      }
      if (params.canApproveActions) {
        tasks.push(
          fetchAdminActions("pending").then((items) => {
            metrics.pendingActions = items.length;
          }),
        );
      }

      await Promise.all(tasks);
      return metrics;
    },
    enabled,
  });
}
