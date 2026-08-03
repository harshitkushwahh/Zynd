"use client";

import { useEffect, useMemo, useState } from "react";
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
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  platformAuditLogsQueryKey,
  usePlatformAuditLogsQuery,
} from "@/hooks/use-platform-audit-logs-query";
import { type AuditLogItem } from "@/lib/admin-api";
import { AUDIT_EVENT_GROUPS, formatAuditEvent } from "@/lib/admin-audit-events";
import { cn } from "@/lib/utils";

const ALL = "all";

const CATEGORY_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All categories" },
  ...AUDIT_EVENT_GROUPS.map((group) => ({
    value: group.label,
    label: group.label,
  })),
];

const EVENT_TYPE_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All event types" },
  ...AUDIT_EVENT_GROUPS.flatMap((group) =>
    group.types.map((eventType) => ({
      value: eventType,
      label: formatAuditEvent(eventType),
    })),
  ),
];

function matchesSearch(log: AuditLogItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    formatAuditEvent(log.event_type),
    log.event_type,
    log.user_email ?? "",
    log.client_id ?? "",
    log.user_id ?? "",
    log.ip_address ?? "",
    formatTimestampDetail(log.created_at),
    JSON.stringify(log.metadata ?? {}),
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

export function PlatformAuditLogsPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState(ALL);
  const [groupFilter, setGroupFilter] = useState(ALL);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const queryParams = { eventFilter, offset, pageSize };
  const { data, isLoading, isFetching, error } = usePlatformAuditLogsQuery(queryParams);

  const logs = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;
  const showSkeleton = isLoading && logs.length === 0;
  const errorMessage = error ? getErrorMessage(error, "Could not load platform audit logs.") : "";

  useEffect(() => {
    setOffset(0);
  }, [eventFilter, pageSize]);

  const filteredLogs = useMemo(
    () => logs.filter((log) => matchesGroupFilter(log, groupFilter) && matchesSearch(log, search)),
    [groupFilter, logs, search],
  );

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: platformAuditLogsQueryKey(queryParams) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search user, event, IP, or metadata"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AdminSelect
            value={groupFilter}
            onValueChange={setGroupFilter}
            options={CATEGORY_OPTIONS}
            placeholder="Category"
            className="min-w-select-lg"
          />
          <AdminSelect
            value={eventFilter}
            onValueChange={setEventFilter}
            options={EVENT_TYPE_OPTIONS}
            placeholder="Event type"
            className="min-w-select-xl"
          />
          <StatusBadge variant="info" showIcon={false}>
            {filteredLogs.length.toLocaleString()} shown
          </StatusBadge>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            aria-label="Refresh platform audit logs"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <AdminFeedbackMessage variant="destructive">{errorMessage}</AdminFeedbackMessage>
      ) : null}

      <AdminDataTable
        minWidth="5xl"
        footer={
          <AdminTablePagination
            page={getOffsetPage(offset, pageSize)}
            hasPrevious={offset > 0}
            hasNext={hasMore}
            disabled={isFetching}
            currentPageCount={filteredLogs.length}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setOffset(0);
            }}
            onPrevious={() => setOffset((value) => Math.max(0, value - pageSize))}
            onNext={() => setOffset((value) => value + pageSize)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Time</AdminTableHeadCell>
            <AdminTableHeadCell>User</AdminTableHeadCell>
            <AdminTableHeadCell>Event</AdminTableHeadCell>
            <AdminTableHeadCell>IP address</AdminTableHeadCell>
            <AdminTableHeadCell>Details</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={5} />
          ) : filteredLogs.length === 0 ? (
            <AdminTableStateRow colSpan={5}>
              No platform audit logs match your filters.
            </AdminTableStateRow>
          ) : (
            filteredLogs.map((log) => (
              <AdminTableRow key={log.id}>
                <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                  {formatTimestampDetail(log.created_at)}
                </AdminTableCell>
                <AdminTableCell>
                  <p className="font-medium text-foreground">
                    {log.user_email ?? "System"}
                  </p>
                  {log.client_id || log.user_id ? (
                    <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                      {log.client_id ?? log.user_id}
                    </p>
                  ) : null}
                </AdminTableCell>
                <AdminTableCell>
                  <p className="font-medium text-foreground">
                    {formatAuditEvent(log.event_type)}
                  </p>
                  <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                    {log.event_type}
                  </p>
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {log.ip_address ?? "—"}
                </AdminTableCell>
                <AdminTableCell className="max-w-sm">
                  <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-caption text-muted-foreground">
                    {Object.keys(log.metadata ?? {}).length
                      ? JSON.stringify(log.metadata, null, 0)
                      : "—"}
                  </pre>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
