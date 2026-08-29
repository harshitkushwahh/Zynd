"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AmcLogo } from "@/components/mf/amc-logo";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { userInitials } from "@/lib/admin-capabilities";
import {
  fetchMfTransactionSipPlans,
  syncMfTransactionSipPlan,
  type MfTransactionSipPlan,
} from "@/lib/mf-transactions-admin-api";
import { MfSipPlanDetailDialog } from "@/components/mf/mf-sip-plan-detail-dialog";
import { cn } from "@/lib/utils";

const ALL = "all";

export const SIP_STATUS_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "REVIEW", label: "Review" },
  { value: "CONSENT_PENDING", label: "Consent pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "FAILED", label: "Failed" },
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function matchesSearch(plan: MfTransactionSipPlan, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    plan.product_name,
    plan.product_id,
    plan.user_display_name,
    plan.user_email,
    plan.client_id,
    plan.status,
    plan.next_action,
    plan.frequency,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function MfTransactionSipPlansPanel({
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
  const [plans, setPlans] = useState<MfTransactionSipPlan[]>([]);
  const [internalSearch, setInternalSearch] = useState("");
  const [internalStatusFilter, setInternalStatusFilter] = useState(ALL);
  const search = onSearchChange ? (searchProp ?? "") : internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const statusFilter = onStatusFilterChange ? (statusFilterProp ?? ALL) : internalStatusFilter;
  const setStatusFilter = onStatusFilterChange ?? setInternalStatusFilter;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [selectedPlan, setSelectedPlan] = useState<MfTransactionSipPlan | null>(null);

  const loadData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchMfTransactionSipPlans({
        status: statusFilter === ALL ? undefined : statusFilter,
        limit: 50,
      });
      setPlans(result.plans);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load SIP plans."));
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

  const filteredPlans = useMemo(
    () => plans.filter((plan) => matchesSearch(plan, search)),
    [plans, search],
  );

  const pagination = useMemo(
    () => paginateItems(filteredPlans, page, pageSize),
    [filteredPlans, page, pageSize],
  );

  const columnCount = canManage ? 7 : 6;
  const showSkeleton = loading && plans.length === 0;

  const handleSyncPlan = async (planId: string) => {
    if (!canManage) return;
    setActionLoading(`sync-${planId}`);
    setMessage("");
    try {
      await syncMfTransactionSipPlan(planId);
      setMessage(`SIP plan ${planId} advanced.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not sync SIP plan."));
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
            placeholder="Search by fund, customer, or ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <AdminSelect
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value)}
              options={SIP_STATUS_OPTIONS}
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

      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}

      <AdminDataTable
        minWidth="5xl"
        footer={
          <AdminTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hasPrevious={pagination.hasPrevious}
            hasNext={pagination.hasNext}
            disabled={loading}
            totalCount={filteredPlans.length}
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
            {canManage ? (
              <AdminTableHeadCell className="w-[5.5rem]">Actions</AdminTableHeadCell>
            ) : null}
            <AdminTableHeadCell>Fund</AdminTableHeadCell>
            <AdminTableHeadCell>Customer</AdminTableHeadCell>
            <AdminTableHeadCell>Amount</AdminTableHeadCell>
            <AdminTableHeadCell>Frequency</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Next installment</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={columnCount} />
          ) : filteredPlans.length === 0 ? (
            <AdminTableStateRow colSpan={columnCount}>
              {plans.length === 0
                ? "No SIP plans found."
                : "No SIP plans match your search."}
            </AdminTableStateRow>
          ) : (
            pagination.items.map((plan) => (
              <AdminTableRow key={plan.plan_id} onClick={() => setSelectedPlan(plan)}>
                {canManage ? (
                  <AdminTableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === `sync-${plan.plan_id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSyncPlan(plan.plan_id);
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      Sync
                    </Button>
                  </AdminTableCell>
                ) : null}
                <AdminTableCell>
                  <div className="flex items-center gap-3">
                    <AmcLogo
                      name={plan.product_name ?? "Fund"}
                      logoUrl={plan.amc_logo_url}
                      className="size-8"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {plan.product_name ?? plan.product_id}
                      </p>
                      {plan.next_action ? (
                        <p className="mt-0.5 text-caption text-muted-foreground">
                          {plan.next_action}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      {plan.user_profile_image_url ? (
                        <AvatarImage src={plan.user_profile_image_url} alt="" />
                      ) : null}
                      <AvatarFallback className="text-micro">
                        {userInitials(plan.user_display_name ?? plan.user_email ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {plan.user_display_name ?? plan.user_email ?? "—"}
                      </p>
                      {plan.client_id ? (
                        <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                          {plan.client_id}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell className="tabular-nums">
                  ₹{plan.amount_inr.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="capitalize text-muted-foreground">
                  {plan.frequency.toLowerCase()}
                </AdminTableCell>
                <AdminTableCell>
                  <OrderStatusBadge status={plan.status} />
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {formatDate(plan.next_installment_date)}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <MfSipPlanDetailDialog
        open={selectedPlan != null}
        planId={selectedPlan?.plan_id ?? null}
        initialPlan={selectedPlan}
        onClose={() => setSelectedPlan(null)}
      />
    </div>
  );
}
