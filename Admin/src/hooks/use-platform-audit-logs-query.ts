"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchAuditLogs, type AuditLogItem } from "@/lib/admin-api";

export type PlatformAuditLogsQueryParams = {
  eventFilter: string;
  groupFilter?: string;
  eventTypes?: readonly string[];
  offset: number;
  pageSize: number;
};

const ALL = "all";

export function platformAuditLogsQueryKey(params: PlatformAuditLogsQueryParams) {
  return [
    "platform-audit-logs",
    {
      event: params.eventFilter === ALL ? null : params.eventFilter,
      group: params.groupFilter === ALL || !params.groupFilter ? null : params.groupFilter,
      eventTypes: params.eventTypes ?? null,
      offset: params.offset,
      pageSize: params.pageSize,
    },
  ] as const;
}

export function usePlatformAuditLogsQuery(params: PlatformAuditLogsQueryParams) {
  return useQuery({
    queryKey: platformAuditLogsQueryKey(params),
    queryFn: async (): Promise<{ items: AuditLogItem[]; hasMore: boolean }> => {
      const items = await fetchAuditLogs({
        event_type: params.eventFilter === ALL ? undefined : params.eventFilter,
        event_types:
          params.eventFilter === ALL && params.eventTypes?.length ? params.eventTypes : undefined,
        limit: params.pageSize,
        offset: params.offset,
      });
      return {
        items,
        hasMore: items.length === params.pageSize,
      };
    },
    placeholderData: keepPreviousData,
  });
}
