"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchAuditLogs, type AuditLogItem } from "@/lib/admin-api";

const ALL = "all";

export type AdminUserActivityQueryParams = {
  userId: string;
  eventFilter: string;
  offset: number;
  pageSize: number;
};

export function adminUserActivityQueryKey(params: AdminUserActivityQueryParams) {
  return [
    "admin-user-activity",
    params.userId,
    {
      event: params.eventFilter === ALL ? null : params.eventFilter,
      offset: params.offset,
      pageSize: params.pageSize,
    },
  ] as const;
}

export function useAdminUserActivityQuery(params: AdminUserActivityQueryParams) {
  return useQuery({
    queryKey: adminUserActivityQueryKey(params),
    queryFn: async (): Promise<{ items: AuditLogItem[]; hasMore: boolean }> => {
      const items = await fetchAuditLogs({
        user_id: params.userId,
        event_type: params.eventFilter === ALL ? undefined : params.eventFilter,
        limit: params.pageSize,
        offset: params.offset,
      });
      return {
        items,
        hasMore: items.length === params.pageSize,
      };
    },
    enabled: Boolean(params.userId),
    placeholderData: keepPreviousData,
  });
}
