"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw, ScrollText } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestampDetail } from "@/lib/format-date";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AdminSectionBreadcrumb } from "@/components/dashboard/admin-section-breadcrumb";
import { AdminPageHeader } from "@/components/dashboard/admin-page-header";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
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
} from "@/components/ui/admin-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  downloadZyndLogsCsv,
  fetchZyndLogs,
  ZYND_LOG_SOURCE_LABELS,
  type ZyndLogItem,
  type ZyndLogSource,
} from "@/lib/zynd-logs-api";
import { ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";

const zyndLogsRoute = ADMIN_NAV_ROUTES.find((route) => route.id === "zynd-logs");

const POLL_INTERVAL_MS = 8_000;
const ALL = "all";

type LogTab = ZyndLogSource;

const LOG_TABS: Array<{ key: LogTab; label: string }> = [
  { key: "cybrilla", label: "Cybrilla logs" },
  { key: "fintech_primitive", label: "Fintech Primitive logs" },
  { key: "kyckart", label: "KYC Kart logs" },
];



function toIsoDateTime(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function logKey(log: ZyndLogItem) {
  return log.id;
}

function mergeLogs(existing: ZyndLogItem[], incoming: ZyndLogItem[]) {
  const seen = new Set(existing.map((item) => item.id));
  const prepended = incoming.filter((item) => !seen.has(item.id));
  if (!prepended.length) return existing;
  const merged = [...prepended, ...existing];
  const maxRows = ADMIN_TABLE_PAGE_SIZE * 4;
  return merged.slice(0, maxRows);
}

export function ZyndLogsPanel() {
  const { hasPermission } = useAdminAuth();
  const canRead = hasPermission("audit.read");

  const [activeTab, setActiveTab] = useState<LogTab>("cybrilla");
  const [logs, setLogs] = useState<ZyndLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState(ALL);
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const latestAtRef = useRef<string | null>(null);

  const queryFilters = useMemo(
    () => ({
      source: activeTab,
      q: search.trim() || undefined,
      success:
        resultFilter === ALL ? undefined : resultFilter === "success" ? true : false,
      from: toIsoDateTime(fromValue),
      to: toIsoDateTime(toValue),
    }),
    [activeTab, fromValue, resultFilter, search, toValue],
  );

  const loadLogs = useCallback(
    async ({ reset = false, since }: { reset?: boolean; since?: string } = {}) => {
      if (!canRead) return;
      if (since) {
        setPolling(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const result = await fetchZyndLogs({
          ...queryFilters,
          limit: ADMIN_TABLE_PAGE_SIZE,
          offset: reset ? 0 : offset,
          since,
        });

        if (since) {
          setLogs((current) => mergeLogs(current, result.items));
        } else {
          setLogs(result.items);
          setOffset(reset ? 0 : offset);
        }

        if (!since) {
          setTotal(result.total);
          setHasMore(result.has_more);
        }

        const newest = result.items[0]?.created_at ?? latestAtRef.current;
        if (newest) latestAtRef.current = newest;
      } catch (err) {
        if (!since) {
          setLogs([]);
          setTotal(0);
          setHasMore(false);
        }
        setError(getErrorMessage(err, "Could not load Zynd logs."));
      } finally {
        setLoading(false);
        setPolling(false);
      }
    },
    [canRead, offset, queryFilters],
  );

  useEffect(() => {
    latestAtRef.current = null;
    setOffset(0);
    void loadLogs({ reset: true });
  }, [activeTab, search, resultFilter, fromValue, toValue]);

  useEffect(() => {
    if (!canRead) return;
    const interval = window.setInterval(() => {
      if (latestAtRef.current) {
        void loadLogs({ since: latestAtRef.current });
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [canRead, loadLogs]);

  useEffect(() => {
    if (offset === 0) return;
    void loadLogs();
  }, [offset]);

  const handleExport = async () => {
    try {
      await downloadZyndLogsCsv(queryFilters);
    } catch (err) {
      setError(getErrorMessage(err, "Could not export Zynd logs."));
    }
  };

  if (!canRead) {
    return (
      <div className="space-y-6">
        <AdminSectionBreadcrumb
          segments={[{ label: zyndLogsRoute?.label ?? "Zynd Logs" }]}
        />
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view Zynd logs.
        </AdminFeedbackMessage>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminSectionBreadcrumb segments={[{ label: zyndLogsRoute?.label ?? "Zynd Logs" }]} />

      <AdminPageHeader
        title={zyndLogsRoute?.label ?? "Zynd Logs"}
        aside={
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleExport()}>
              <Download className="size-3.5" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void loadLogs({ reset: true })}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <div className="admin-page-icon-tile shrink-0">
              <ScrollText className="size-5" />
            </div>
          </div>
        }
      />

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {polling ? (
        <p className="text-caption text-muted-foreground">Checking for new log entries…</p>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as LogTab)}
        className="gap-6"
      >
        <AdminTabList>
          {LOG_TABS.map((tab) => (
            <AdminTabTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </AdminTabTrigger>
          ))}
        </AdminTabList>

        {LOG_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-0 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AdminSearchInput
                containerClassName="min-w-0 max-w-sm sm:w-56"
                placeholder="Search user, client ID, action, path, or error"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Input
                  type="datetime-local"
                  className="w-full sm:w-auto"
                  value={fromValue}
                  onChange={(event) => setFromValue(event.target.value)}
                  aria-label="From date"
                />
                <Input
                  type="datetime-local"
                  className="w-full sm:w-auto"
                  value={toValue}
                  onChange={(event) => setToValue(event.target.value)}
                  aria-label="To date"
                />
                <Select value={resultFilter} onValueChange={(value) => setResultFilter(value ?? ALL)}>
                  <SelectTrigger size="sm" className="min-w-select-md">
                    <SelectValue placeholder="All results" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All results</SelectItem>
                    <SelectItem value="success">Successful only</SelectItem>
                    <SelectItem value="failed">Failed only</SelectItem>
                  </SelectContent>
                </Select>
                <StatusBadge variant="info" showIcon={false}>
                  {total.toLocaleString()} entries
                </StatusBadge>
                <StatusBadge variant="neutral" showIcon={false}>
                  {ZYND_LOG_SOURCE_LABELS[tab.key]}
                </StatusBadge>
              </div>
            </div>

            <AdminDataTable minWidth="7xl">
              <AdminTableHeader>
                <tr>
                  <AdminTableHeadCell>Time</AdminTableHeadCell>
                  <AdminTableHeadCell>User</AdminTableHeadCell>
                  <AdminTableHeadCell>Action</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  <AdminTableHeadCell className="text-right">Duration</AdminTableHeadCell>
                  <AdminTableHeadCell>Path</AdminTableHeadCell>
                </tr>
              </AdminTableHeader>
              <AdminTableBody>
                {loading ? (
                  <AdminTableSkeletonRows columns={6} />
                ) : logs.length === 0 ? (
                  <AdminTableStateRow colSpan={6}>
                    No logs match your filters for this provider.
                  </AdminTableStateRow>
                ) : (
                  logs.map((log) => (
                    <AdminTableRow key={logKey(log)}>
                      <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                        {formatTimestampDetail(log.created_at)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <p className="font-medium text-foreground">
                          {log.user_email ?? "System"}
                        </p>
                        {log.user_id ? (
                          <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                            {log.user_id}
                          </p>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell>
                        <p className="font-medium text-foreground">{log.action}</p>
                        <p className="mt-0.5 text-caption text-muted-foreground">
                          {log.method}
                          {log.error_code ? ` · ${log.error_code}` : ""}
                        </p>
                      </AdminTableCell>
                      <AdminTableCell>
                        <StatusBadge variant={log.success ? "success" : "destructive"}>
                          {log.status_code ?? (log.success ? "OK" : "Failed")}
                        </StatusBadge>
                      </AdminTableCell>
                      <AdminTableCell className="text-right tabular-nums text-muted-foreground">
                        {log.duration_ms != null ? `${log.duration_ms} ms` : "—"}
                      </AdminTableCell>
                      <AdminTableCell className="max-w-xs truncate font-mono text-caption text-muted-foreground">
                        {log.path}
                      </AdminTableCell>
                    </AdminTableRow>
                  ))
                )}
              </AdminTableBody>
            </AdminDataTable>

            {!loading && logs.length > 0 ? (
              <AdminTablePagination
                page={Math.floor(offset / ADMIN_TABLE_PAGE_SIZE)}
                totalPages={Math.max(1, Math.ceil(total / ADMIN_TABLE_PAGE_SIZE))}
                hasPrevious={offset > 0}
                hasNext={hasMore}
                disabled={loading}
                onPrevious={() => setOffset((value) => Math.max(0, value - ADMIN_TABLE_PAGE_SIZE))}
                onNext={() => setOffset((value) => value + ADMIN_TABLE_PAGE_SIZE)}
              />
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
