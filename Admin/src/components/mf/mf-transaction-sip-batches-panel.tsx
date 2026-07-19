"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Repeat, RotateCcw } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format-date";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AmcLogo } from "@/components/mf/amc-logo";
import { MfMandateDetailDialog } from "@/components/mf/mf-mandate-detail-dialog";
import { MfOrderCustomerCell } from "@/components/mf/mf-order-journey-dialog";
import { OrderStatusBadge } from "@/components/users/user-status-badge";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfTransactionSipBatches,
  syncMfTransactionMandate,
  type MfTransactionSipBatch,
} from "@/lib/mf-transactions-admin-api";

const ALL = "all";

const MANDATE_STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "AUTH_PENDING", label: "Auth pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;



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

export function MfTransactionSipBatchesPanel({
  canRead,
  canManage,
  title = "Bulk SIP orders",
}: {
  canRead: boolean;
  canManage: boolean;
  title?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [batches, setBatches] = useState<MfTransactionSipBatch[]>([]);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(0);
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
    setPage(0);
  }, [statusFilter]);

  const pagination = useMemo(
    () => paginateItems(batches, page, ADMIN_TABLE_PAGE_SIZE),
    [batches, page],
  );

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
    <div className="space-y-3">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSectionTitle icon={Repeat}>{title}</AdminSectionTitle>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? ALL)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses">
              {MANDATE_STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ??
                "All statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Filter by mandate status</SelectLabel>
              {MANDATE_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <AdminDataTable minWidth="6xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Customer</AdminTableHeadCell>
            <AdminTableHeadCell>Funds</AdminTableHeadCell>
            <AdminTableHeadCell>SIPs</AdminTableHeadCell>
            <AdminTableHeadCell>Mandate</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Monthly total</AdminTableHeadCell>
            <AdminTableHeadCell>Created</AdminTableHeadCell>
            {canManage ? <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell> : null}
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableSkeletonRows columns={canManage ? 7 : 6} />
          ) : pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={canManage ? 7 : 6}>No bulk SIP orders found.</AdminTableStateRow>
          ) : (
            pagination.items.map((batch) => (
              <AdminTableRow
                key={batch.batch_id}
                onClick={() => setSelectedMandateId(batch.mandate_id)}
              >
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
                {canManage ? (
                  <AdminTableCell className="text-right">
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
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      {!loading && batches.length > 0 ? (
        <AdminTablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          hasPrevious={pagination.hasPrevious}
          hasNext={pagination.hasNext}
          disabled={loading}
          onPrevious={() => setPage((current) => Math.max(0, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      ) : null}

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
