"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { fetchAuditLogs, type AuditLogItem } from "@/lib/admin-api";
import { AUDIT_EVENT_GROUPS, formatAuditEvent } from "@/lib/admin-audit-events";
import { ApiError } from "@/lib/api-client";
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
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState(ALL);
  const [groupFilter, setGroupFilter] = useState(ALL);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await fetchAuditLogs({
        user_id: userId,
        event_type: eventFilter === ALL ? undefined : eventFilter,
        limit: ADMIN_TABLE_PAGE_SIZE,
        offset,
      });
      setLogs(items);
      setHasMore(items.length === ADMIN_TABLE_PAGE_SIZE);
    } catch (err) {
      setLogs([]);
      setHasMore(false);
      setError(getErrorMessage(err, "Could not load activity."));
    } finally {
      setLoading(false);
    }
  }, [eventFilter, offset, userId]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

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

  const handleSearch = () => {
    if (offset !== 0) {
      setOffset(0);
      return;
    }
    void loadLogs();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search events, IP, or date"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSearch();
          }}
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

          <Button variant="outline" size="icon" onClick={() => void loadLogs()} aria-label="Refresh">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
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
          {loading ? (
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
        page={getOffsetPage(offset)}
        hasPrevious={offset > 0}
        hasNext={hasMore}
        disabled={loading}
        onPrevious={() => setOffset((value) => Math.max(0, value - ADMIN_TABLE_PAGE_SIZE))}
        onNext={() => setOffset((value) => value + ADMIN_TABLE_PAGE_SIZE)}
      />
    </div>
  );
}
