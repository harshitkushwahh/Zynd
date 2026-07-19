"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IndianRupee, ShoppingCart } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format-date";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { MfOrderCustomerCell } from "@/components/mf/mf-order-journey-dialog";
import { MfTransactionCheckoutDetailDialog } from "@/components/mf/mf-transaction-checkout-detail-dialog";
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
  fetchMfTransactionCheckouts,
  type MfTransactionCheckout,
} from "@/lib/mf-transactions-admin-api";

const ALL = "all";

const CHECKOUT_STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PAYMENT_PENDING", label: "Payment pending" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SUCCEEDED", label: "Succeeded" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;



function formatFundSummary(checkout: MfTransactionCheckout) {
  const names = checkout.orders
    .map((order) => order.product_name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) {
    return `${checkout.order_count} fund${checkout.order_count === 1 ? "" : "s"}`;
  }
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

export function MfTransactionCheckoutsPanel({
  canRead,
  title = "Bulk lumpsum orders",
}: {
  canRead: boolean;
  title?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkouts, setCheckouts] = useState<MfTransactionCheckout[]>([]);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(0);
  const [selectedCheckoutId, setSelectedCheckoutId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchMfTransactionCheckouts({
        checkout_type: "CART",
        status: statusFilter === ALL ? undefined : statusFilter,
        limit: 50,
      });
      setCheckouts(result.checkouts);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load bulk orders."));
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
    () => paginateItems(checkouts, page, ADMIN_TABLE_PAGE_SIZE),
    [checkouts, page],
  );

  return (
    <div className="space-y-3">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSectionTitle icon={IndianRupee}>{title}</AdminSectionTitle>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? ALL)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses">
              {CHECKOUT_STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ??
                "All statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Filter by status</SelectLabel>
              {CHECKOUT_STATUS_OPTIONS.map((option) => (
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
            <AdminTableHeadCell>Customer</AdminTableHeadCell>
            <AdminTableHeadCell>Funds</AdminTableHeadCell>
            <AdminTableHeadCell>Products</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Total amount</AdminTableHeadCell>
            <AdminTableHeadCell>Created</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableSkeletonRows columns={6} />
          ) : pagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={6}>No bulk lumpsum orders found.</AdminTableStateRow>
          ) : (
            pagination.items.map((checkout) => (
              <AdminTableRow
                key={checkout.checkout_id}
                onClick={() => setSelectedCheckoutId(checkout.checkout_id)}
              >
                <AdminTableCell>
                  <MfOrderCustomerCell
                    order={{
                      order_id: checkout.checkout_id,
                      status: checkout.status,
                      amount_inr: checkout.total_amount_inr,
                      user_display_name: checkout.user_display_name,
                      user_email: checkout.user_email,
                      user_profile_image_url: checkout.user_profile_image_url,
                      client_id: checkout.client_id,
                    }}
                  />
                </AdminTableCell>
                <AdminTableCell className="max-w-xs truncate text-muted-foreground">
                  {formatFundSummary(checkout)}
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ShoppingCart className="size-3.5" />
                    <span>
                      {checkout.order_count} lumpsum
                      {checkout.sip_item_count > 0 ? ` · ${checkout.sip_item_count} SIP` : ""}
                    </span>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <OrderStatusBadge status={checkout.status} />
                </AdminTableCell>
                <AdminTableCell className="text-right tabular-nums">
                  ₹{checkout.total_amount_inr.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {formatTimestamp(checkout.created_at)}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      {!loading && checkouts.length > 0 ? (
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

      <MfTransactionCheckoutDetailDialog
        open={selectedCheckoutId != null}
        checkoutId={selectedCheckoutId}
        onClose={() => setSelectedCheckoutId(null)}
      />
    </div>
  );
}
