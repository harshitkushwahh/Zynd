"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { referralReferrerDetailHref } from "@/lib/admin-referrals-navigation";
import { userDashboardProfileHref } from "@/lib/admin-user-ref";
import {
  formatReferralInr,
  syncAdminReferralRedemptions,
  updateAdminReferralRedemptionStatus,
  type AdminReferralRewardLedgerEntry,
} from "@/lib/referrals-admin-api";
import { useAdminSearch } from "@/hooks/use-admin-search";
import { formatTimestampDetail } from "@/lib/format-date";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: AdminSelectOption[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "reversed", label: "Reversed" },
  { value: "cancelled", label: "Cancelled" },
];

function statusVariant(status: AdminReferralRewardLedgerEntry["status"]) {
  if (status === "paid") return "success" as const;
  if (status === "approved") return "info" as const;
  if (status === "pending") return "warning" as const;
  if (status === "reversed") return "neutral" as const;
  return "neutral" as const;
}

export function ReferralsRedemptionHistoryPanel() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("referrals.manage");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const {
    items,
    loading,
    error,
    refetch,
    setError,
  } = useAdminSearch<AdminReferralRewardLedgerEntry>({
    scope: "referrals.redemptions",
    query: search,
    status,
    limit: ADMIN_TABLE_PAGE_SIZE,
    offset,
  });
  const hasMore = items.length === ADMIN_TABLE_PAGE_SIZE;

  useEffect(() => {
    setOffset(0);
  }, [search, status]);

  const handleSync = async () => {
    if (!canManage) return;
    setActionLoading("sync");
    setError("");
    setMessage("");
    try {
      const result = await syncAdminReferralRedemptions();
      setMessage(`Synced ${result.created} new reward entries from ${result.processed} qualified referrals.`);
      await refetch();
    } catch (err) {
      setError(getErrorMessage(err, "Could not sync redemption ledger."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async (entry: AdminReferralRewardLedgerEntry) => {
    if (!canManage || entry.status === "paid") return;
    setActionLoading(entry.id);
    setError("");
    try {
      await updateAdminReferralRedemptionStatus(entry.id, { status: "paid" });
      await refetch();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update redemption status."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSearchInput
          containerClassName="w-full max-w-sm"
          placeholder="Search referrer, referee, rule..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AdminSelect
            value={status}
            onValueChange={(value) => setStatus(value ?? "all")}
            options={STATUS_OPTIONS}
            placeholder="Status"
            className="min-w-select-sm"
            triggerClassName="w-auto"
          />
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={actionLoading === "sync"}
              onClick={() => void handleSync()}
            >
              Sync ledger
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="icon" onClick={() => void refetch()} aria-label="Refresh">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {message ? (
        <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>
          {message}
        </AdminFeedbackMessage>
      ) : null}
      {error ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {error}
        </AdminFeedbackMessage>
      ) : null}

      <AdminDataTable
        minWidth="xl"
        footer={
          <AdminTablePagination
            page={getOffsetPage(offset)}
            hasPrevious={offset > 0}
            hasNext={hasMore}
            disabled={loading}
            currentPageCount={items.length}
            hasMore={hasMore}
            onPrevious={() => setOffset((current) => Math.max(0, current - ADMIN_TABLE_PAGE_SIZE))}
            onNext={() => setOffset((current) => current + ADMIN_TABLE_PAGE_SIZE)}
          />
        }
      >
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Referrer</AdminTableHeadCell>
            <AdminTableHeadCell>Referee</AdminTableHeadCell>
            <AdminTableHeadCell>Rule</AdminTableHeadCell>
            <AdminTableHeadCell>Amount</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell>Earned</AdminTableHeadCell>
            {canManage ? <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell> : null}
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading && items.length === 0 ? (
            <AdminTableSkeletonRows columns={canManage ? 7 : 6} />
          ) : items.length === 0 ? (
            <AdminTableStateRow colSpan={canManage ? 7 : 6}>
              No redemption entries yet. Sync the ledger after referrals qualify.
            </AdminTableStateRow>
          ) : (
            items.map((item) => (
              <AdminTableRow key={item.id}>
                <AdminTableCell>
                  {item.referrer ? (
                    <>
                      <Link
                        href={referralReferrerDetailHref(item.referrer.client_id)}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.referrer.display_name}
                      </Link>
                      <p className="text-caption text-muted-foreground">{item.referrer.email}</p>
                    </>
                  ) : (
                    "—"
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  {item.referee ? (
                    <>
                      <Link
                        href={userDashboardProfileHref(item.referee.client_id, "referrals")}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.referee.display_name}
                      </Link>
                      <p className="text-caption text-muted-foreground">{item.referee.email}</p>
                    </>
                  ) : (
                    "—"
                  )}
                </AdminTableCell>
                <AdminTableCell>{item.rule_name}</AdminTableCell>
                <AdminTableCell>{formatReferralInr(item.amount_inr)}</AdminTableCell>
                <AdminTableCell>
                  <StatusBadge variant={statusVariant(item.status)}>{item.status}</StatusBadge>
                </AdminTableCell>
                <AdminTableCell>{formatTimestampDetail(item.earned_at)}</AdminTableCell>
                {canManage ? (
                  <AdminTableCell className="text-right">
                    {item.status !== "paid" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionLoading === item.id}
                        onClick={() => void handleMarkPaid(item)}
                      >
                        Mark paid
                      </Button>
                    ) : (
                      <span className="text-caption text-muted-foreground">
                        {item.paid_at ? formatTimestampDetail(item.paid_at) : "Paid"}
                      </span>
                    )}
                  </AdminTableCell>
                ) : null}
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>
    </div>
  );
}
