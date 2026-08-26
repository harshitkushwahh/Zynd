"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchAdminActions,
  fetchPendingDeletions,
  fetchPendingKycReviewCount,
  fetchSecurityReviews,
  type AdminActionItem,
  type PendingDeletionItem,
  type SecurityReviewItem,
} from "@/lib/admin-api";

type AdminComplianceQueryParams = {
  canReadReviews: boolean;
  canExecuteDeletions: boolean;
  canApproveActions: boolean;
  canReadDocuments: boolean;
};

export function adminComplianceQueryKey(params: AdminComplianceQueryParams) {
  return [
    "admin-user-compliance",
    {
      reviews: params.canReadReviews,
      deletions: params.canExecuteDeletions,
      actions: params.canApproveActions,
      kyc: params.canReadDocuments,
    },
  ] as const;
}

export type AdminComplianceData = {
  reviews: SecurityReviewItem[];
  deletions: PendingDeletionItem[];
  pendingActions: AdminActionItem[];
  pendingKycReviews: number;
};

export function useAdminComplianceQuery(params: AdminComplianceQueryParams) {
  return useQuery({
    queryKey: adminComplianceQueryKey(params),
    queryFn: async (): Promise<AdminComplianceData> => {
      const tasks: Promise<unknown>[] = [];
      let reviews: SecurityReviewItem[] = [];
      let deletions: PendingDeletionItem[] = [];
      let pendingActions: AdminActionItem[] = [];
      let pendingKycReviews = 0;

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
      if (params.canReadDocuments) {
        tasks.push(fetchPendingKycReviewCount().then((payload) => {
          pendingKycReviews = payload.count;
        }));
      }

      await Promise.all(tasks);
      return { reviews, deletions, pendingActions, pendingKycReviews };
    },
    enabled:
      params.canReadReviews ||
      params.canExecuteDeletions ||
      params.canApproveActions ||
      params.canReadDocuments,
  });
}
