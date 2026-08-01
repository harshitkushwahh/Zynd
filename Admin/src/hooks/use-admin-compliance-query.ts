"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchAdminActions,
  fetchPendingDeletions,
  fetchSecurityReviews,
  type AdminActionItem,
  type PendingDeletionItem,
  type SecurityReviewItem,
} from "@/lib/admin-api";

type AdminComplianceQueryParams = {
  canReadReviews: boolean;
  canExecuteDeletions: boolean;
  canApproveActions: boolean;
};

export function adminComplianceQueryKey(params: AdminComplianceQueryParams) {
  return [
    "admin-user-compliance",
    {
      reviews: params.canReadReviews,
      deletions: params.canExecuteDeletions,
      actions: params.canApproveActions,
    },
  ] as const;
}

export type AdminComplianceData = {
  reviews: SecurityReviewItem[];
  deletions: PendingDeletionItem[];
  pendingActions: AdminActionItem[];
};

export function useAdminComplianceQuery(params: AdminComplianceQueryParams) {
  return useQuery({
    queryKey: adminComplianceQueryKey(params),
    queryFn: async (): Promise<AdminComplianceData> => {
      const tasks: Promise<unknown>[] = [];
      let reviews: SecurityReviewItem[] = [];
      let deletions: PendingDeletionItem[] = [];
      let pendingActions: AdminActionItem[] = [];

      if (params.canReadReviews) {
        tasks.push(fetchSecurityReviews("open").then((items) => {
          reviews = items;
        }));
      }
      if (params.canExecuteDeletions) {
        tasks.push(fetchPendingDeletions().then((items) => {
          deletions = items;
        }));
      }
      if (params.canApproveActions) {
        tasks.push(fetchAdminActions("pending").then((items) => {
          pendingActions = items;
        }));
      }

      await Promise.all(tasks);
      return { reviews, deletions, pendingActions };
    },
    enabled:
      params.canReadReviews || params.canExecuteDeletions || params.canApproveActions,
  });
}
