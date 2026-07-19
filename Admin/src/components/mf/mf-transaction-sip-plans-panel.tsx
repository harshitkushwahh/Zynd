"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, RotateCcw } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AmcLogo } from "@/components/mf/amc-logo";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { userInitials } from "@/lib/admin-capabilities";
import {
  fetchMfTransactionSipPlans,
  syncMfTransactionSipPlan,
  type MfTransactionSipPlan,
} from "@/lib/mf-transactions-admin-api";

const ALL = "all";

const SIP_STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "REVIEW", label: "Review" },
  { value: "CONSENT_PENDING", label: "Consent pending" },
  { value: "ACTIVE", label: "Active" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "FAILED", label: "Failed" },
] as const;


function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MfTransactionSipPlansPanel({
  canRead,
  canManage,
  title = "SIP plans",
}: {
  canRead: boolean;
  canManage: boolean;
  title?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [plans, setPlans] = useState<MfTransactionSipPlan[]>([]);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(0);

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
    setPage(0);
  }, [statusFilter]);

  const pagination = useMemo(
    () => paginateItems(plans, page, ADMIN_TABLE_PAGE_SIZE),
    [page, plans],
  );

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
    <div className="space-y-3">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSectionTitle icon={CalendarClock}>{title}</AdminSectionTitle>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? ALL)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses">
              {SIP_STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ??
                "All statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Filter by status</SelectLabel>
              {SIP_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <AdminDataTable minWidth="5xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Fund</AdminTableHeadCell>
            <AdminTableHeadCell>Customer</AdminTableHeadCell>
            <AdminTableHeadCell>Amount</AdminTableHeadCell>
            <AdminTableHeadCell>Frequency</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Next installment</AdminTableHeadCell>
            {canManage ? <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell> : null}
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableSkeletonRows columns={canManage ? 7 : 6} />
          ) : pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={canManage ? 7 : 6}>No SIP plans found.</AdminTableStateRow>
          ) : (
            pagination.items.map((plan) => (
              <AdminTableRow key={plan.plan_id}>
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
                {canManage ? (
                  <AdminTableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === `sync-${plan.plan_id}`}
                      onClick={() => void handleSyncPlan(plan.plan_id)}
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

      {!loading && plans.length > 0 ? (
        <AdminTablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          hasPrevious={pagination.hasPrevious}
          hasNext={pagination.hasNext}
          disabled={loading}
          onPrevious={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() => setPage((value) => value + 1)}
        />
      ) : null}
    </div>
  );
}
