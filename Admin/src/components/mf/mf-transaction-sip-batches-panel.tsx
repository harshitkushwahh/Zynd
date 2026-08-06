"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format-date";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AmcLogo } from "@/components/mf/amc-logo";
import { MfMandateDetailDialog } from "@/components/mf/mf-mandate-detail-dialog";
import { MfOrderCustomerCell } from "@/components/mf/mf-order-journey-dialog";
import { OrderStatusBadge } from "@/components/users/user-status-badge";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
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
import { Button } from "@/components/ui/button";
import {
  fetchMfTransactionSipBatches,
  syncMfTransactionMandate,
  type MfTransactionSipBatch,
} from "@/lib/mf-transactions-admin-api";
import { cn } from "@/lib/utils";

const ALL = "all";

export const SIP_BATCH_STATUS_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "AUTH_PENDING", label: "Auth pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function formatPlanSummary(batch: MfTransactionSipBatch) {
  const names = batch.plans
    .map((plan) => plan.product_name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) {
    return `${batch.plan_count} SIP${batch.plan_count === 1 ? "" : "s"}`;
  }
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

function matchesSearch(batch: MfTransactionSipBatch, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    batch.user_display_name,
    batch.user_email,
    batch.client_id,
    batch.batch_id,
    batch.mandate_id,
    batch.mandate_status,
    formatPlanSummary(batch),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function MfTransactionSipBatchesPanel({
  canRead,
  canManage,
  showToolbar = true,
  search: searchProp,
  onSearchChange,
  statusFilter: statusFilterProp,
  onStatusFilterChange,
  refreshKey,
}: {
  canRead: boolean;
  canManage: boolean;
  showToolbar?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  refreshKey?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [batches, setBatches] = useState<MfTransactionSipBatch[]>([]);
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
      const result = await fetchMfTransactionSipBatches({
        status: statusFilter === ALL ? undefined : statusFilter,
        limit: 50,
      });
      setBatches(result.batches);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load bulk SIP orders."));
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

  const filteredBatches = useMemo(
    () => batches.filter((batch) => matchesSearch(batch, search)),
    [batches, search],
  );

  const pagination = useMemo(
    () => paginateItems(filteredBatches, page, pageSize),
    [filteredBatches, page, pageSize],
  );

  const columnCount = canManage ? 7 : 6;
  const showSkeleton = loading && batches.length === 0;

  const handleSyncMandate = async (mandateId: string) => {
    if (!canManage) return;
    setActionLoading(`sync-${mandateId}`);
    setMessage("");
    try {
      await syncMfTransactionMandate(mandateId);
      setMessage(`Mandate ${mandateId} synced.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not sync mandate."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {showToolbar ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminSearchInput
            containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
            placeholder="Search by customer, fund, or ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <AdminSelect
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
              options={SIP_BATCH_STATUS_OPTIONS}
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
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <AdminDataTable
        minWidth="6xl"
        footer={
          <AdminTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hasPrevious={pagination.hasPrevious}
            hasNext={pagination.hasNext}
            disabled={loading}
            totalCount={filteredBatches.length}
            currentPageCount={pagination.items.length}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(0);
            }}
            onPrevious={() => setPage((current) => Math.max(0, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            {canManage ? (
              <AdminTableHeadCell className="w-[5.5rem]">Actions</AdminTableHeadCell>
            ) : null}
            <AdminTableHeadCell>Customer</AdminTableHeadCell>
            <AdminTableHeadCell>Funds</AdminTableHeadCell>
            <AdminTableHeadCell>SIPs</AdminTableHeadCell>
            <AdminTableHeadCell>Mandate</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Monthly total</AdminTableHeadCell>
            <AdminTableHeadCell>Created</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={columnCount} />
          ) : filteredBatches.length === 0 ? (
            <AdminTableStateRow colSpan={columnCount}>
              {batches.length === 0
                ? "No bulk SIP orders found."
                : "No bulk SIP orders match your search."}
            </AdminTableStateRow>
          ) : (
            pagination.items.map((batch) => (
              <AdminTableRow
                key={batch.batch_id}
                onClick={() => setSelectedMandateId(batch.mandate_id)}
              >
                {canManage ? (
                  <AdminTableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === `sync-${batch.mandate_id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSyncMandate(batch.mandate_id);
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      Sync
                    </Button>
                  </AdminTableCell>
                ) : null}
                <AdminTableCell>
                  <MfOrderCustomerCell
                    order={{
                      order_id: batch.batch_id,
                      status: batch.mandate_status,
                      amount_inr: batch.total_amount_inr,
                      user_display_name: batch.user_display_name,
                      user_email: batch.user_email,
                      user_profile_image_url: batch.user_profile_image_url,
                      client_id: batch.client_id,
                    }}
                  />
                </AdminTableCell>
                <AdminTableCell className="max-w-xs truncate text-muted-foreground">
                  {formatPlanSummary(batch)}
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {batch.plans.slice(0, 3).map((plan) => (
                        <AmcLogo
                          key={plan.plan_id}
                          name={plan.product_name ?? "Fund"}
                          logoUrl={plan.amc_logo_url}
                          className="size-6 border border-background"
                        />
                      ))}
                    </div>
                    <span className="text-muted-foreground">{batch.plan_count} SIPs</span>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <OrderStatusBadge status={batch.mandate_status} />
                </AdminTableCell>
                <AdminTableCell className="text-right tabular-nums">
                  ₹{batch.total_amount_inr.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {formatTimestamp(batch.created_at)}
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
