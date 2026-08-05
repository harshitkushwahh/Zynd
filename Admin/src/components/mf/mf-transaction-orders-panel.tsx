"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import {
  MfOrderCustomerCell,
  MfOrderFundCell,
  MfOrderJourneyDialog,
} from "@/components/mf/mf-order-journey-dialog";
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
  fetchMfTransactionOrders,
  syncMfTransactionOrder,
  type MfTransactionOrder,
} from "@/lib/mf-transactions-admin-api";
import { cn } from "@/lib/utils";

const ALL = "all";

const ORDER_SORT_OPTIONS: AdminSelectOption[] = [
  { value: "recent", label: "Recent first" },
  { value: "oldest", label: "Oldest first" },
  { value: "updated_recent", label: "Recently updated" },
  { value: "updated_oldest", label: "Least recently updated" },
  { value: "amount_high", label: "Amount · high to low" },
  { value: "amount_low", label: "Amount · low to high" },
  { value: "product_az", label: "Fund name · A to Z" },
  { value: "product_za", label: "Fund name · Z to A" },
  { value: "status_az", label: "Status · A to Z" },
];

const ORDER_STATUS_OPTIONS: AdminSelectOption[] = [
  { value: ALL, label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "payment_pending", label: "Payment pending" },
  { value: "processing", label: "Processing" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

type OrderSortKey =
  | "recent"
  | "oldest"
  | "updated_recent"
  | "updated_oldest"
  | "amount_high"
  | "amount_low"
  | "product_az"
  | "product_za"
  | "status_az";

function formatOrderTimestamp(order: MfTransactionOrder) {
  const value = order.settled_at ?? order.submitted_at ?? order.created_at;
  return value ? new Date(value).toLocaleString() : "No data";
}

function orderActivityTimestamp(order: MfTransactionOrder) {
  return order.settled_at ?? order.submitted_at ?? order.created_at ?? "";
}

function sortOrders(orders: MfTransactionOrder[], sort: OrderSortKey) {
  const copy = [...orders];
  switch (sort) {
    case "oldest":
      return copy.sort((left, right) =>
        (left.created_at ?? "").localeCompare(right.created_at ?? ""),
      );
    case "updated_recent":
      return copy.sort((left, right) =>
        orderActivityTimestamp(right).localeCompare(orderActivityTimestamp(left)),
      );
    case "updated_oldest":
      return copy.sort((left, right) =>
        orderActivityTimestamp(left).localeCompare(orderActivityTimestamp(right)),
      );
    case "amount_high":
      return copy.sort((left, right) => right.amount_inr - left.amount_inr);
    case "amount_low":
      return copy.sort((left, right) => left.amount_inr - right.amount_inr);
    case "product_az":
      return copy.sort((left, right) =>
        (left.product_name ?? "").localeCompare(right.product_name ?? "", undefined, {
          sensitivity: "base",
        }),
      );
    case "product_za":
      return copy.sort((left, right) =>
        (right.product_name ?? "").localeCompare(left.product_name ?? "", undefined, {
          sensitivity: "base",
        }),
      );
    case "status_az":
      return copy.sort((left, right) => left.status.localeCompare(right.status));
    case "recent":
    default:
      return copy.sort((left, right) =>
        (right.created_at ?? "").localeCompare(left.created_at ?? ""),
      );
  }
}

function matchesSearch(order: MfTransactionOrder, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    order.product_name,
    order.product_id,
    order.user_display_name,
    order.user_email,
    order.client_id,
    order.order_id,
    order.status,
    order.order_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function MfTransactionOrdersPanel({
  canRead,
  canManage,
  orderType,
  checkoutType,
  emptyMessage = "No orders found.",
}: {
  canRead: boolean;
  canManage: boolean;
  title?: string;
  orderType?: string;
  checkoutType?: string;
  emptyMessage?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [orders, setOrders] = useState<MfTransactionOrder[]>([]);
  const [search, setSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState(ALL);
  const [orderSort, setOrderSort] = useState<OrderSortKey>("recent");
  const [orderPage, setOrderPage] = useState(0);
  const [pageSize, setPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchMfTransactionOrders({
        status: orderStatusFilter === ALL ? undefined : orderStatusFilter,
        order_type: orderType,
        checkout_type: checkoutType,
        limit: 50,
      });
      setOrders(result.orders);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load orders."));
    } finally {
      setLoading(false);
    }
  }, [canRead, orderStatusFilter, orderType, checkoutType]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setOrderPage(0);
  }, [orderStatusFilter, orderSort, search, pageSize]);

  const filteredOrders = useMemo(
    () => sortOrders(orders.filter((order) => matchesSearch(order, search)), orderSort),
    [orderSort, orders, search],
  );

  const orderPagination = useMemo(
    () => paginateItems(filteredOrders, orderPage, pageSize),
    [filteredOrders, orderPage, pageSize],
  );

  const columnCount = canManage ? 7 : 6;
  const showSkeleton = loading && orders.length === 0;

  const handleSyncOrder = async (orderId: string) => {
    if (!canManage) return;
    setActionLoading(`sync-${orderId}`);
    setMessage("");
    try {
      await syncMfTransactionOrder(orderId);
      setMessage(`Order ${orderId} reconciled.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not sync order."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSearchInput
          containerClassName="max-w-sm"
          placeholder="Search by fund, customer, or ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <AdminSelect
            value={orderSort}
            onValueChange={(value) => setOrderSort(value as OrderSortKey)}
            options={ORDER_SORT_OPTIONS}
            placeholder="Sort"
            className="min-w-select-sm"
          />
          <AdminSelect
            value={orderStatusFilter}
            onValueChange={(value) => setOrderStatusFilter(value)}
            options={ORDER_STATUS_OPTIONS}
            placeholder="Status"
            className="min-w-select-sm"
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

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <AdminDataTable
        minWidth="6xl"
        footer={
          <AdminTablePagination
            page={orderPagination.page}
            totalPages={orderPagination.totalPages}
            hasPrevious={orderPagination.hasPrevious}
            hasNext={orderPagination.hasNext}
            disabled={loading}
            totalCount={filteredOrders.length}
            currentPageCount={orderPagination.items.length}
            pageSize={pageSize}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setOrderPage(0);
            }}
            onPrevious={() => setOrderPage((page) => Math.max(0, page - 1))}
            onNext={() => setOrderPage((page) => page + 1)}
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
            <AdminTableHeadCell>Type</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Amount</AdminTableHeadCell>
            <AdminTableHeadCell>Updated</AdminTableHeadCell>
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {showSkeleton ? (
            <AdminTableSkeletonRows columns={columnCount} />
          ) : filteredOrders.length === 0 ? (
            <AdminTableStateRow colSpan={columnCount}>
              {orders.length === 0 ? emptyMessage : "No orders match your search."}
            </AdminTableStateRow>
          ) : (
            orderPagination.items.map((order, index) => (
              <AdminTableRow
                key={order.order_id ?? `order-${index}`}
                onClick={() => setSelectedOrderId(order.order_id)}
              >
                {canManage ? (
                  <AdminTableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoading === `sync-${order.order_id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSyncOrder(order.order_id);
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      Sync
                    </Button>
                  </AdminTableCell>
                ) : null}
                <AdminTableCell>
                  <MfOrderFundCell order={order} />
                </AdminTableCell>
                <AdminTableCell>
                  <MfOrderCustomerCell order={order} />
                </AdminTableCell>
                <AdminTableCell className="capitalize text-muted-foreground">
                  {order.order_type?.replaceAll("_", " ") ?? "—"}
                </AdminTableCell>
                <AdminTableCell>
                  <OrderStatusBadge status={order.status} />
                </AdminTableCell>
                <AdminTableCell className="text-right tabular-nums">
                  ₹{order.amount_inr.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="text-muted-foreground">
                  {formatOrderTimestamp(order)}
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      <MfOrderJourneyDialog
        open={selectedOrderId != null}
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}
