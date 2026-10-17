"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CheckCircle2, Clock3, Wallet } from "lucide-react";

import { SupportTransactionDetailDialog } from "@/components/transactions/support-transaction-detail-dialog";
import { Table } from "@/components/application/table";
import {
  DISTRIBUTOR_TABLE_PAGE_SIZE,
  DISTRIBUTOR_TABLE_PAGE_SIZE_OPTIONS,
  type TablePaginationProps,
} from "@/components/application/table/pagination";
import {
  SupportPageMetricTile,
  SupportPageMetricTilesGrid,
} from "@/components/dashboard/support-page-metric-tile";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { SupportMetricsTilesSkeleton, SupportTableSkeleton } from "@/components/dashboard/support-table-skeleton";
import { SupportFilterSelect } from "@/components/ui/support-filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  DISTRIBUTOR_PAGE_STACK_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
} from "@/lib/distributor-layout";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import type { DistributorOrder, OrderStatus } from "@/lib/distributor-types";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { orderStatusVariant } from "@/lib/status-meta";
import {
  fetchSupportTransactionsPage,
  type SupportTransactionMetrics,
} from "@/lib/support-transactions-api";
import { supportUserDetailHref } from "@/lib/support-users-api";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "Pending", label: "Pending" },
  { value: "Processing", label: "Processing" },
  { value: "Completed", label: "Completed" },
  { value: "Failed", label: "Failed" },
];

type OrderTypeFilter = DistributorOrder["orderType"] | "all";

const ORDER_TYPE_OPTIONS: Array<{ value: OrderTypeFilter; label: string }> = [
  { value: "Purchase", label: "Purchase" },
  { value: "Redeem", label: "Redeem" },
  { value: "Switch", label: "Switch" },
];

const EMPTY_METRICS: SupportTransactionMetrics = {
  totalTransactions: 0,
  inProgress: 0,
  completed: 0,
  failed: 0,
  volumeInr: 0,
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function SupportTransactionsPanel() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 350);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>("all");
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [metrics, setMetrics] = useState<SupportTransactionMetrics>(EMPTY_METRICS);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DISTRIBUTOR_TABLE_PAGE_SIZE);
  const [selectedOrder, setSelectedOrder] = useState<DistributorOrder | null>(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);

  const offset = (page - 1) * pageSize;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, typeFilter, pageSize]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    void fetchSupportTransactionsPage({
      search: debouncedSearch || undefined,
      status: statusFilter,
      orderType: typeFilter,
      limit: pageSize,
      offset,
    })
      .then((result) => {
        setOrders(result.items);
        if (result.metrics) setMetrics(result.metrics);
        setTotalCount(result.totalCount);
      })
      .catch(() => {
        setOrders([]);
        setMetrics(EMPTY_METRICS);
        setTotalCount(0);
        setLoadError("Could not load transactions. Try again in a moment.");
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, typeFilter, pageSize, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const pagination = useMemo<TablePaginationProps>(
    () => ({
      page: Math.min(page, totalPages),
      totalPages,
      onPageChange: setPage,
      pageSize,
      pageSizeOptions: DISTRIBUTOR_TABLE_PAGE_SIZE_OPTIONS,
      onPageSizeChange: (next) => {
        setPageSize(next);
        setPage(1);
      },
      totalItemCount: totalCount,
      alwaysVisible: totalCount > 0,
    }),
    [page, totalPages, pageSize, totalCount],
  );

  const clearDisabled =
    statusFilter === "all" && typeFilter === "all" && searchQuery.trim() === "";

  const openOrder = (order: DistributorOrder) => {
    setSelectedOrder(order);
    setOrderDetailOpen(true);
  };

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setStatusFilter("all");
        setTypeFilter("all");
        setPage(1);
      }}
      clearDisabled={clearDisabled}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search by Zynd ID, email, order ref…"
          aria-label="Search transactions"
        />
      }
    >
      <SupportFilterSelect
        label="Status"
        value={statusFilter}
        options={STATUS_OPTIONS}
        onValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />
      <SupportFilterSelect
        label="Order type"
        value={typeFilter}
        options={ORDER_TYPE_OPTIONS}
        onValueChange={(value) => {
          setTypeFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label="Support transactions"
      className="min-w-[var(--table-min-width-4xl)]"
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="orderRef" label="Order" isRowHeader />
        <Table.Head id="clientCode" label="Client" />
        <Table.Head id="schemeName" label="Scheme" />
        <Table.Head id="orderType" label="Type" />
        <Table.Head id="amount" label="Amount" className="text-right [&>div]:justify-end" />
        <Table.Head id="status" label="Status" />
        <Table.Head
          id="createdAt"
          label="Created"
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={orders}>
        {(order) => (
          <Table.Row id={order.id} className="cursor-pointer" onAction={() => openOrder(order)}>
            <Table.Cell>
              <p className="font-mono text-caption font-medium">{order.orderRef}</p>
            </Table.Cell>
            <Table.Cell>
              <button
                type="button"
                className="font-mono text-caption text-primary hover:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  router.push(supportUserDetailHref(order.clientCode));
                }}
              >
                {order.clientCode}
              </button>
            </Table.Cell>
            <Table.Cell className="max-w-[16rem] truncate">{order.schemeName}</Table.Cell>
            <Table.Cell className="text-muted-foreground">{order.orderType}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatAum(order.amount)}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={orderStatusVariant(order.status)}>{order.status}</StatusBadge>
            </Table.Cell>
            <Table.Cell
              className={cn("text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}
            >
              {formatDistributorDate(order.createdAt)}
            </Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Transactions" />

      {loading && orders.length === 0 ? (
        <SupportMetricsTilesSkeleton />
      ) : (
        <SupportPageMetricTilesGrid>
          <SupportPageMetricTile
            tileTone="accent"
            icon={ArrowLeftRight}
            label="Transactions"
            value={String(metrics.totalTransactions)}
          />
          <SupportPageMetricTile icon={Clock3} label="In progress" value={String(metrics.inProgress)} />
          <SupportPageMetricTile
            tileTone="success"
            icon={CheckCircle2}
            label="Completed"
            value={String(metrics.completed)}
          />
          <SupportPageMetricTile
            icon={Wallet}
            label="Volume (settled)"
            value={formatAum(metrics.volumeInr)}
            fitTileValue
          />
        </SupportPageMetricTilesGrid>
      )}

      <DistributorTableOnlyShell
        toolbar={toolbar}
        isLoading={loading}
        loadingSkeleton={<SupportTableSkeleton rowCount={10} columnCount={7} />}
        isEmpty={!loading && orders.length === 0}
        emptyTitle={loadError || "No transactions match your filters"}
        emptyDescription={
          loadError ? undefined : DISTRIBUTOR_CLIENT_COPY.activity.filtersEmptyDescription
        }
        tableSize="md"
      >
        {table}
      </DistributorTableOnlyShell>

      <SupportTransactionDetailDialog
        open={orderDetailOpen}
        onOpenChange={setOrderDetailOpen}
        order={selectedOrder}
      />
    </div>
  );
}
