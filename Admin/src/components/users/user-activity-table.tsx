"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestampDetail } from "@/lib/format-date";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
  getOffsetPage,
} from "@/components/ui/admin-table";
import { Button } from "@/components/ui/button";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminUserActivityQueryKey,
  useAdminUserActivityQuery,
} from "@/hooks/use-admin-user-activity-query";
import { AUDIT_EVENT_GROUPS, formatAuditEvent } from "@/lib/admin-audit-events";
import { type AuditLogItem } from "@/lib/admin-api";
import { cn } from "@/lib/utils";

const ALL = "all";

function matchesSearch(log: AuditLogItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    formatAuditEvent(log.event_type),
    log.event_type,
    log.ip_address ?? "",
    formatTimestampDetail(log.created_at),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function matchesGroupFilter(log: AuditLogItem, groupKey: string) {
  if (groupKey === ALL) return true;
  const group = AUDIT_EVENT_GROUPS.find((item) => item.label === groupKey);
  if (!group) return true;
  return (group.types as readonly string[]).includes(log.event_type);
}

export function UserActivityTable({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState(ALL);
  const [groupFilter, setGroupFilter] = useState(ALL);
  const [offset, setOffset] = useState(0);

  const queryParams = {
    userId,
    eventFilter,
    offset,
    pageSize: ADMIN_TABLE_PAGE_SIZE,
  };
  const { data, isPending, isFetching, error: queryError } = useAdminUserActivityQuery(queryParams);

  const logs = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;
  const showSkeleton = isPending && logs.length === 0;
  const error = queryError ? getErrorMessage(queryError, "Could not load activity.") : "";

  const filteredLogs = useMemo(
    () => logs.filter((log) => matchesGroupFilter(log, groupFilter) && matchesSearch(log, search)),
    [groupFilter, logs, search],
  );

  const handleEventFilterChange = (value: string | null) => {
    setEventFilter(value ?? ALL);
    setOffset(0);
  };

  const handleGroupFilterChange = (value: string | null) => {
    setGroupFilter(value ?? ALL);
  };

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: adminUserActivityQueryKey(queryParams) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search events, IP, or date"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select value={groupFilter} onValueChange={handleGroupFilterChange}>
            <SelectTrigger size="sm" className="min-w-select-lg">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {AUDIT_EVENT_GROUPS.map((group) => (
                <SelectItem key={group.label} value={group.label}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={eventFilter} onValueChange={handleEventFilterChange}>
            <SelectTrigger size="sm" className="min-w-select-xl">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent className="max-h-scroll-md">
              <SelectItem value={ALL}>All event types</SelectItem>
              {AUDIT_EVENT_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.types.map((eventType) => (
                    <SelectItem key={eventType} value={eventType}>
                      {formatAuditEvent(eventType)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={handleRefresh} aria-label="Refresh">
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <AdminDataTable minWidth="md">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Event</AdminTableHeadCell>
            <AdminTableHeadCell>Date & time</AdminTableHeadCell>
            <AdminTableHeadCell>IP address</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={3} />
          ) : filteredLogs.length === 0 ? (
            <AdminTableStateRow colSpan={3}>No activity matches your filters.</AdminTableStateRow>
          ) : (
            filteredLogs.map((log) => (
              <AdminTableRow key={log.id}>
                <AdminTableCell className="font-medium text-foreground">
                  {formatAuditEvent(log.event_type)}
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {formatTimestampDetail(log.created_at)}
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">{log.ip_address ?? "—"}</AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <AdminTablePagination
        page={getOffsetPage(offset, ADMIN_TABLE_PAGE_SIZE)}
        hasPrevious={offset > 0}
        hasNext={hasMore}
        disabled={isFetching}
        onPrevious={() => setOffset((value) => Math.max(0, value - ADMIN_TABLE_PAGE_SIZE))}
        onNext={() => setOffset((value) => value + ADMIN_TABLE_PAGE_SIZE)}
      />
    </div>
  );
}
