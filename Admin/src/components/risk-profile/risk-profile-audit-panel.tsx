"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestampDetail } from "@/lib/format-date";

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
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";
import { AUDIT_EVENT_GROUPS, formatAuditEvent } from "@/lib/admin-audit-events";
import {
  riskAuditLogsQueryKey,
  useRiskAuditLogsQuery,
} from "@/hooks/use-risk-profile-queries";
import { type RiskAuditLogItem } from "@/lib/risk-profile-admin-api";
import { cn } from "@/lib/utils";

const ALL = "all";
const RISK_PROFILE_GROUP = "Risk profile";

function matchesSearch(log: RiskAuditLogItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    formatAuditEvent(log.event_type),
    log.event_type,
    log.user_id ?? "",
    log.ip_address ?? "",
    formatTimestampDetail(log.created_at),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function RiskProfileAuditPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState(ALL);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

  const queryParams = {
    eventType: eventFilter === ALL ? undefined : eventFilter,
    limit: pageSize,
    offset,
  };
  const { data, isPending, isFetching, error: queryError } = useRiskAuditLogsQuery(queryParams);
  const logs = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;
  const error = queryError
    ? getErrorMessage(queryError, "Could not load risk profile audit logs.")
    : "";

  const eventFilterOptions = useMemo<AdminSelectOption[]>(() => {
    const group = AUDIT_EVENT_GROUPS.find((item) => item.label === RISK_PROFILE_GROUP);
    const types = group?.types ?? [];
    return [
      { value: ALL, label: "All risk events" },
      ...types.map((eventType) => ({
        value: eventType,
        label: formatAuditEvent(eventType),
      })),
    ];
  }, []);

  const filteredLogs = useMemo(
    () => logs.filter((log) => matchesSearch(log, search)),
    [logs, search],
  );

  const showSkeleton = isPending && !data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search events, user, IP, or date"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <AdminSelect
            value={eventFilter}
            onValueChange={(value) => {
              setEventFilter(value);
              setOffset(0);
            }}
            options={eventFilterOptions}
            placeholder="Event type"
            className="min-w-select-xl"
          />

          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: riskAuditLogsQueryKey(queryParams) })
            }
            aria-label="Refresh"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <AdminDataTable
        minWidth="lg"
        footer={
          <AdminTablePagination
            page={getOffsetPage(offset, pageSize)}
            hasPrevious={offset > 0}
            hasNext={hasMore}
            disabled={isFetching}
            currentPageCount={filteredLogs.length}
            hasMore={hasMore}
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
            <AdminTableHeadCell>Event</AdminTableHeadCell>
            <AdminTableHeadCell>User</AdminTableHeadCell>
            <AdminTableHeadCell>Date & time</AdminTableHeadCell>
            <AdminTableHeadCell>IP address</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={4} />
          ) : filteredLogs.length === 0 ? (
            <AdminTableStateRow colSpan={4}>No audit events match your filters.</AdminTableStateRow>
          ) : (
            filteredLogs.map((log) => (
              <AdminTableRow key={log.id}>
                <AdminTableCell className="font-medium text-foreground">
                  {formatAuditEvent(log.event_type)}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-caption text-muted-foreground">
                  {log.user_id ?? "—"}
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {formatTimestampDetail(log.created_at)}
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {log.ip_address ?? "—"}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
