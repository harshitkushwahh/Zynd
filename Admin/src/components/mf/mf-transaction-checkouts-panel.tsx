"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ShoppingCart } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format-date";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { MfOrderCustomerCell } from "@/components/mf/mf-order-journey-dialog";
import { MfTransactionCheckoutDetailDialog } from "@/components/mf/mf-transaction-checkout-detail-dialog";
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
  fetchMfTransactionCheckouts,
  type MfTransactionCheckout,
} from "@/lib/mf-transactions-admin-api";
import { cn } from "@/lib/utils";

const ALL = "all";

export const CHECKOUT_STATUS_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PAYMENT_PENDING", label: "Payment pending" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SUCCEEDED", label: "Succeeded" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

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

function matchesSearch(checkout: MfTransactionCheckout, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    checkout.user_display_name,
    checkout.user_email,
    checkout.client_id,
    checkout.checkout_id,
    checkout.status,
    formatFundSummary(checkout),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function MfTransactionCheckoutsPanel({
  canRead,
  showToolbar = true,
  search: searchProp,
  onSearchChange,
  statusFilter: statusFilterProp,
  onStatusFilterChange,
  refreshKey,
}: {
  canRead: boolean;
  showToolbar?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  refreshKey?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkouts, setCheckouts] = useState<MfTransactionCheckout[]>([]);
  const [internalSearch, setInternalSearch] = useState("");
  const [internalStatusFilter, setInternalStatusFilter] = useState(ALL);
  const search = onSearchChange ? (searchProp ?? "") : internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const statusFilter = onStatusFilterChange ? (statusFilterProp ?? ALL) : internalStatusFilter;
  const setStatusFilter = onStatusFilterChange ?? setInternalStatusFilter;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
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
    if (refreshKey == null || refreshKey === 0) return;
    void loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, search, pageSize]);

  const filteredCheckouts = useMemo(
    () => checkouts.filter((checkout) => matchesSearch(checkout, search)),
    [checkouts, search],
  );

  const pagination = useMemo(
    () => paginateItems(filteredCheckouts, page, pageSize),
    [filteredCheckouts, page, pageSize],
  );

  const showSkeleton = loading && checkouts.length === 0;

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
              options={CHECKOUT_STATUS_OPTIONS}
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

      <AdminDataTable
        minWidth="5xl"
        footer={
          <AdminTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            hasPrevious={pagination.hasPrevious}
            hasNext={pagination.hasNext}
            disabled={loading}
            totalCount={filteredCheckouts.length}
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
            <AdminTableHeadCell>Customer</AdminTableHeadCell>
            <AdminTableHeadCell>Funds</AdminTableHeadCell>
            <AdminTableHeadCell>Products</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Total amount</AdminTableHeadCell>
            <AdminTableHeadCell>Created</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={6} />
          ) : filteredCheckouts.length === 0 ? (
            <AdminTableStateRow colSpan={6}>
              {checkouts.length === 0
                ? "No bulk lumpsum orders found."
                : "No bulk lumpsum orders match your search."}
            </AdminTableStateRow>
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

      <MfTransactionCheckoutDetailDialog
        open={selectedCheckoutId != null}
        checkoutId={selectedCheckoutId}
        onClose={() => setSelectedCheckoutId(null)}
      />
    </div>
  );
}
