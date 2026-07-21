"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  AdminTableRows,
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
import { AUDIT_EVENT_GROUPS, formatAuditEvent } from "@/lib/admin-audit-events";
import { fetchRiskAuditLogs, type RiskAuditLogItem } from "@/lib/risk-profile-admin-api";
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
  const [logs, setLogs] = useState<RiskAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState(ALL);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const riskEventTypes = useMemo(() => {
    const group = AUDIT_EVENT_GROUPS.find((item) => item.label === RISK_PROFILE_GROUP);
    return group?.types ?? [];
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchRiskAuditLogs({
        event_type: eventFilter === ALL ? undefined : eventFilter,
        limit: ADMIN_TABLE_PAGE_SIZE,
        offset,
      });
      setLogs(result.items);
      setHasMore(result.items.length === ADMIN_TABLE_PAGE_SIZE);
    } catch (err) {
      setLogs([]);
      setHasMore(false);
      setError(getErrorMessage(err, "Could not load risk profile audit logs."));
    } finally {
      setLoading(false);
    }
  }, [eventFilter, offset]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(
    () => logs.filter((log) => matchesSearch(log, search)),
    [logs, search],
  );

  const handleEventFilterChange = (value: string | null) => {
    setEventFilter(value ?? ALL);
    setOffset(0);
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
          placeholder="Search events, user, IP, or date"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSearch();
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select value={eventFilter} onValueChange={handleEventFilterChange}>
            <SelectTrigger size="sm" className="min-w-select-xl">
              <SelectValue placeholder="Event type" />
            </SelectTrigger>
            <SelectContent className="max-h-scroll-md">
              <SelectItem value={ALL}>All risk events</SelectItem>
              <SelectGroup>
                <SelectLabel>{RISK_PROFILE_GROUP}</SelectLabel>
                {riskEventTypes.map((eventType) => (
                  <SelectItem key={eventType} value={eventType}>
                    {formatAuditEvent(eventType)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={() => void loadLogs()} aria-label="Refresh">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <AdminDataTable minWidth="lg">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Event</AdminTableHeadCell>
            <AdminTableHeadCell>User</AdminTableHeadCell>
            <AdminTableHeadCell>Date & time</AdminTableHeadCell>
            <AdminTableHeadCell>IP address</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          <AdminTableRows
            colSpan={4}
            loading={loading}
            isEmpty={filteredLogs.length === 0}
            emptyMessage="No audit events match your filters."
          >
            {filteredLogs.map((log) => (
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
                <AdminTableCell className="text-muted-foreground">{log.ip_address ?? "—"}</AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableRows>
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
