"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, ShoppingCart } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import {
  MfOrderCustomerCell,
  MfOrderFundCell,
  MfOrderJourneyDialog,
} from "@/components/mf/mf-order-journey-dialog";
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
  fetchMfTransactionOrders,
  syncMfTransactionOrder,
  type MfTransactionOrder,
} from "@/lib/mf-transactions-admin-api";

const ALL = "all";

const ORDER_SORT_OPTIONS = [
  { value: "recent", label: "Recent first" },
  { value: "oldest", label: "Oldest first" },
  { value: "updated_recent", label: "Recently updated" },
  { value: "updated_oldest", label: "Least recently updated" },
  { value: "amount_high", label: "Amount · high to low" },
  { value: "amount_low", label: "Amount · low to high" },
  { value: "product_az", label: "Fund name · A to Z" },
  { value: "product_za", label: "Fund name · Z to A" },
  { value: "status_az", label: "Status · A to Z" },
] as const;

const ORDER_STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "payment_pending", label: "Payment pending" },
  { value: "processing", label: "Processing" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type OrderSortKey = (typeof ORDER_SORT_OPTIONS)[number]["value"];


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

export function MfTransactionOrdersPanel({
  canRead,
  canManage,
  title = "Purchase orders",
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
  const [orderStatusFilter, setOrderStatusFilter] = useState(ALL);
  const [orderSort, setOrderSort] = useState<OrderSortKey>("recent");
  const [orderPage, setOrderPage] = useState(0);
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
  }, [orderStatusFilter, orderSort]);

  const sortedOrders = useMemo(() => sortOrders(orders, orderSort), [orderSort, orders]);
  const orderPagination = useMemo(
    () => paginateItems(sortedOrders, orderPage, ADMIN_TABLE_PAGE_SIZE),
    [orderPage, sortedOrders],
  );

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
    <div className="space-y-3">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminSectionTitle icon={ShoppingCart}>{title}</AdminSectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={orderSort}
            onValueChange={(value) => setOrderSort((value ?? "recent") as OrderSortKey)}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Sort orders">
                {ORDER_SORT_OPTIONS.find((option) => option.value === orderSort)?.label ??
                  "Recent first"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Sort by</SelectLabel>
                {ORDER_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={orderStatusFilter}
            onValueChange={(value) => setOrderStatusFilter(value ?? ALL)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All statuses">
                {ORDER_STATUS_OPTIONS.find((option) => option.value === orderStatusFilter)?.label ??
                  "All statuses"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Filter by status</SelectLabel>
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <AdminDataTable minWidth="6xl">
        <AdminTableHeader>
          <tr>
            <AdminTableHeadCell>Fund</AdminTableHeadCell>
            <AdminTableHeadCell>Customer</AdminTableHeadCell>
            <AdminTableHeadCell>Type</AdminTableHeadCell>
            <AdminTableHeadCell>Status</AdminTableHeadCell>
            <AdminTableHeadCell className="text-right">Amount</AdminTableHeadCell>
            <AdminTableHeadCell>Updated</AdminTableHeadCell>
            {canManage ? <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell> : null}
          </tr>
        </AdminTableHeader>
        <AdminTableBody>
          {loading ? (
            <AdminTableSkeletonRows columns={canManage ? 7 : 6} />
          ) : orderPagination.items.length === 0 ? (
            <AdminTableStateRow colSpan={canManage ? 7 : 6}>{emptyMessage}</AdminTableStateRow>
          ) : (
            orderPagination.items.map((order, index) => (
              <AdminTableRow
                key={order.order_id ?? `order-${index}`}
                onClick={() => setSelectedOrderId(order.order_id)}
              >
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
                {canManage ? (
                  <AdminTableCell className="text-right">
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
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminDataTable>

      {!loading && sortedOrders.length > 0 ? (
        <AdminTablePagination
          page={orderPagination.page}
          totalPages={orderPagination.totalPages}
          hasPrevious={orderPagination.hasPrevious}
          hasNext={orderPagination.hasNext}
          disabled={loading}
          onPrevious={() => setOrderPage((page) => Math.max(0, page - 1))}
          onNext={() => setOrderPage((page) => page + 1)}
        />
      ) : null}

      <MfOrderJourneyDialog
        open={selectedOrderId != null}
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}
