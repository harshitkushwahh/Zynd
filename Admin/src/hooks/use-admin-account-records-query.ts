"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchAuditLogs, type AuditLogItem } from "@/lib/admin-api";
import { isAdminAccountJourneyEvent } from "@/lib/admin-audit-events";

const ALL = "all";

export type AdminAccountRecordsQueryParams = {
  userRef: string;
  eventFilter: string;
  offset: number;
  pageSize: number;
};

export function adminAccountRecordsQueryKey(params: AdminAccountRecordsQueryParams) {
  return [
    "admin-account-records",
    params.userRef,
    {
      event: params.eventFilter === ALL ? null : params.eventFilter,
      offset: params.offset,
      pageSize: params.pageSize,
    },
  ] as const;
}

export function useAdminAccountRecordsQuery(params: AdminAccountRecordsQueryParams) {
  return useQuery({
    queryKey: adminAccountRecordsQueryKey(params),
    queryFn: async (): Promise<{ items: AuditLogItem[]; hasMore: boolean }> => {
      const items = await fetchAuditLogs({
        user_id: params.userRef,
        event_type: params.eventFilter === ALL ? undefined : params.eventFilter,
        limit: params.pageSize,
        offset: params.offset,
      });
      const journeyItems = items.filter((item) => isAdminAccountJourneyEvent(item.event_type));
      return {
        items: journeyItems,
        hasMore: items.length === params.pageSize,
      };
    },
    enabled: Boolean(params.userRef),
    placeholderData: keepPreviousData,
  });
}
