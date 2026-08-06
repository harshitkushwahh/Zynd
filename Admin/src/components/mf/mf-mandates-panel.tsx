"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck, Timer, Users } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { MfMandateDetailDialog } from "@/components/mf/mf-mandate-detail-dialog";
import { OrderStatusBadge } from "@/components/users/user-status-badge";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
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
  paginateItems,
} from "@/components/ui/admin-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { userInitials } from "@/lib/admin-capabilities";
import {
  fetchMfTransactionMandates,
  type MfTransactionMandate,
} from "@/lib/mf-transactions-admin-api";
import { cn } from "@/lib/utils";

const ALL = "all";

export const MANDATE_STATUS_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "AUTH_PENDING", label: "Auth pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function formatInr(value: number) {
  return `₹${value.toLocaleString()}`;
}

function matchesSearch(mandate: MfTransactionMandate, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    mandate.user_display_name,
    mandate.user_email,
    mandate.client_id,
    mandate.mandate_id,
    mandate.status,
    mandate.fp_mandate_status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function MfMandatesPanel({
  canRead,
  canManage,
  showSummaryCards = true,
  showToolbar = true,
  search: searchProp,
  onSearchChange,
  statusFilter: statusFilterProp,
  onStatusFilterChange,
  refreshKey,
}: {
  canRead: boolean;
  canManage: boolean;
  showSummaryCards?: boolean;
  showToolbar?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  refreshKey?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mandates, setMandates] = useState<MfTransactionMandate[]>([]);
  const [summary, setSummary] = useState({
    total_mandates: 0,
    active_mandates: 0,
    auth_pending_mandates: 0,
  });
  const [internalSearch, setInternalSearch] = useState("");
  const [internalStatusFilter, setInternalStatusFilter] = useState(ALL);
  const search = onSearchChange ? (searchProp ?? "") : internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const statusFilter = onStatusFilterChange ? (statusFilterProp ?? ALL) : internalStatusFilter;
  const setStatusFilter = onStatusFilterChange ?? setInternalStatusFilter;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [selectedMandateId, setSelectedMandateId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchMfTransactionMandates({
        status: statusFilter === ALL ? undefined : statusFilter,
        limit: 50,
      });
      setMandates(result.mandates);
      setSummary(result.summary);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load mandates."));
    } finally {
      setLoading(false);
    }
  }, [canRead, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (refreshKey == null || refreshKey === 0) return;
    void loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, search, pageSize]);

  const filteredMandates = useMemo(
    () => mandates.filter((mandate) => matchesSearch(mandate, search)),
    [mandates, search],
  );

  const pagination = useMemo(
    () => paginateItems(filteredMandates, page, pageSize),
    [filteredMandates, page, pageSize],
  );

  const showSkeleton = loading && mandates.length === 0;

  const summaryMetrics = [
    {
      key: "total",
      label: "Total mandates",
      value: summary.total_mandates.toLocaleString(),
      infoDescription: "All user mandates linked to systematic plans.",
      icon: Users,
      tone: "info" as const,
      accent: true,
    },
    {
      key: "active",
      label: "Active mandates",
      value: summary.active_mandates.toLocaleString(),
      infoDescription: "Approved mandates ready for SIP collections.",
      icon: ShieldCheck,
      tone: summary.active_mandates > 0 ? ("success" as const) : ("muted" as const),
    },
    {
      key: "auth-pending",
      label: "Auth pending",
      value: summary.auth_pending_mandates.toLocaleString(),
      infoDescription: "Mandates waiting for customer authorization.",
      icon: Timer,
      tone: summary.auth_pending_mandates > 0 ? ("warning" as const) : ("muted" as const),
    },
  ];

  return (
    <div className="space-y-4">
      {showSummaryCards ? (
        <AdminMetricCardsGrid columns="three" className="!mt-0">
          {summaryMetrics.map((metric) => (
            <AdminMetricCard
              key={metric.key}
              label={metric.label}
              value={metric.value}
              infoDescription={metric.infoDescription}
              icon={metric.icon}
              tone={metric.tone}
              accent={metric.accent}
              loading={loading}
            />
          ))}
        </AdminMetricCardsGrid>
      ) : null}

      {showToolbar ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminSearchInput
            containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
            placeholder="Search by customer or mandate ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <AdminSelect
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
              options={MANDATE_STATUS_OPTIONS}
              placeholder="Status"
              className="min-w-select-sm"
              triggerClassName="w-auto"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void loadData()}
              aria-label="Refresh"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <AdminDataTable
        minWidth="7xl"
        footer={
          <AdminTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hasPrevious={pagination.hasPrevious}
            hasNext={pagination.hasNext}
            disabled={loading}
            totalCount={filteredMandates.length}
            currentPageCount={pagination.items.length}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(0);
            }}
            onPrevious={() => setPage((value) => Math.max(0, value - 1))}
            onNext={() => setPage((value) => value + 1)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Customer</AdminTableHeadCell>
            <AdminTableHeadCell>Mandate status</AdminTableHeadCell>
            <AdminTableHeadCell>FP status</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Active SIPs</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Working SIPs</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Cancelled</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Limit</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={7} />
          ) : filteredMandates.length === 0 ? (
            <AdminTableStateRow colSpan={7}>
              {mandates.length === 0
                ? "No mandates found."
                : "No mandates match your search."}
            </AdminTableStateRow>
          ) : (
            pagination.items.map((mandate) => (
              <AdminTableRow
                key={mandate.mandate_id}
                onClick={() => setSelectedMandateId(mandate.mandate_id)}
              >
                <AdminTableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      {mandate.user_profile_image_url ? (
                        <AvatarImage src={mandate.user_profile_image_url} alt="" />
                      ) : null}
                      <AvatarFallback className="text-micro">
                        {userInitials(mandate.user_display_name ?? mandate.user_email ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {mandate.user_display_name ?? mandate.user_email ?? "—"}
                      </p>
                      {mandate.client_id ? (
                        <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                          {mandate.client_id}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <OrderStatusBadge status={mandate.status} />
                </AdminTableCell>
                <AdminTableCell>
                  {mandate.fp_mandate_status ? (
                    <StatusBadge variant="neutral" showIcon={false} className="normal-case">
                      {mandate.fp_mandate_status}
                    </StatusBadge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-right tabular-nums">
                  {mandate.sip_plan_counts.active.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="text-right tabular-nums">
                  {mandate.sip_plan_counts.working.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="text-right tabular-nums">
                  {mandate.sip_plan_counts.cancelled.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="text-right tabular-nums text-muted-foreground">
                  {formatInr(mandate.mandate_limit)}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <MfMandateDetailDialog
        open={selectedMandateId != null}
        mandateId={selectedMandateId}
        canManage={canManage}
        onClose={() => setSelectedMandateId(null)}
        onUpdated={() => void loadData()}
      />
    </div>
  );
}
