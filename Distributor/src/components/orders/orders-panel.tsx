"use client";

import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";

import {
  Table,
  useDistributorTablePagination,
} from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import {
  getScopedOrders,
  type DistributorOrdersListScope,
} from "@/lib/distributor-operations-orders-scope";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DistributorOrder, OrderStatus } from "@/lib/dummy/types";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { orderStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

const TABLE_MIN_CLASS = "min-w-[var(--table-min-width-4xl)]";

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

type OrdersPanelProps = DistributorPageConfig & {
  layout?: "page" | "table";
  operationsListScope?: DistributorOrdersListScope;
  /** @deprecated Use operationsListScope */
  ordersListScope?: DistributorOrdersListScope;
};

export function OrdersPanel({
  layout = "table",
  operationsListScope,
  ordersListScope,
}: OrdersPanelProps) {
  const listScope = operationsListScope ?? ordersListScope ?? "your-book";
  const sourceOrders = useMemo(() => getScopedOrders(listScope), [listScope]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  const filtered = useMemo(() => {
    return sourceOrders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (typeFilter !== "all" && order.orderType !== typeFilter) return false;
      return distributorTableSearchMatch(
        searchQuery,
        order.orderRef,
        order.clientCode,
        order.investorEmailMasked,
        order.schemeName,
        order.orderType,
      );
    });
  }, [searchQuery, sourceOrders, statusFilter, typeFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const clearDisabled =
    statusFilter === "all" && typeFilter === "all" && searchQuery.trim() === "";

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
          placeholder="Search orders…"
          aria-label="Search orders"
        />
      }
    >
      <StatusFilterSelect
        label="Status"
        value={statusFilter}
        options={STATUS_OPTIONS}
        onValueChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
      />
      <StatusFilterSelect
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
      aria-label={listScope === "all" ? "All orders" : "Your orders"}
      className={TABLE_MIN_CLASS}
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="orderRef" label="Order" isRowHeader allowsSorting />
        <Table.Head id="investorEmailMasked" label="Investor" allowsSorting />
        <Table.Head id="schemeName" label="Scheme" allowsSorting />
        <Table.Head id="orderType" label="Type" allowsSorting />
        <Table.Head
          id="amount"
          label="Amount"
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head id="status" label="Status" allowsSorting />
        <Table.Head
          id="createdAt"
          label="Created"
          allowsSorting
          className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(order) => (
          <Table.Row id={order.id}>
            <Table.Cell>
              <p className="font-mono text-caption font-medium">{order.orderRef}</p>
              <p className="text-caption text-muted-foreground">{order.clientCode}</p>
            </Table.Cell>
            <Table.Cell className="text-muted-foreground">{order.investorEmailMasked}</Table.Cell>
            <Table.Cell>{order.schemeName}</Table.Cell>
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

  if (layout === "page") {
    return null;
  }

  return (
    <DistributorTableOnlyShell
      toolbar={toolbar}
      isEmpty={sorted.length === 0}
      emptyTitle="No orders match your filters"
      emptyDescription="Adjust filters, search, or clear all to reset."
    >
      {table}
    </DistributorTableOnlyShell>
  );
}
