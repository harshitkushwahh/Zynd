"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Timer, Users } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { MfMandateDetailDialog } from "@/components/mf/mf-mandate-detail-dialog";
import { OrderStatusBadge } from "@/components/users/user-status-badge";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
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
import { StatusBadge } from "@/components/ui/status-badge";
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
  fetchMfTransactionMandates,
  type MfTransactionMandate,
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


function formatInr(value: number) {
  return `₹${value.toLocaleString()}`;
}

export function MfMandatesPanel({
  canRead,
  canManage,
}: {
  canRead: boolean;
  canManage: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mandates, setMandates] = useState<MfTransactionMandate[]>([]);
  const [summary, setSummary] = useState({
    total_mandates: 0,
    active_mandates: 0,
    auth_pending_mandates: 0,
  });
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(0);
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
    setPage(0);
  }, [statusFilter]);

  const pagination = useMemo(
    () => paginateItems(mandates, page, ADMIN_TABLE_PAGE_SIZE),
    [mandates, page],
  );

  const summaryMetrics = [
    {
      key: "total",
      label: "Total mandates",
      value: summary.total_mandates.toLocaleString(),
      icon: Users,
      tone: "muted" as const,
    },
    {
      key: "active",
      label: "Active mandates",
      value: summary.active_mandates.toLocaleString(),
      icon: ShieldCheck,
      tone: summary.active_mandates > 0 ? ("success" as const) : ("muted" as const),
    },
    {
      key: "auth-pending",
      label: "Auth pending",
      value: summary.auth_pending_mandates.toLocaleString(),
      icon: Timer,
      tone: summary.auth_pending_mandates > 0 ? ("warning" as const) : ("muted" as const),
    },
  ];

  return (
    <div className="space-y-5">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaryMetrics.map((metric) => (
          <AdminMetricCard
            key={metric.key}
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
            tone={metric.tone}
            loading={loading}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSectionTitle icon={ShieldCheck}>User mandates</AdminSectionTitle>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? ALL)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses">
              {MANDATE_STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ??
                "All statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Filter by status</SelectLabel>
              {MANDATE_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <AdminDataTable minWidth="7xl">
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
          {loading ? (
            <AdminTableSkeletonRows columns={7} />
          ) : pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={7}>No mandates found.</AdminTableStateRow>
          ) : (
            pagination.items.map((mandate) => (
              <AdminTableRow
                key={mandate.mandate_id}
                className="cursor-pointer"
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

      {!loading && mandates.length > 0 ? (
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
