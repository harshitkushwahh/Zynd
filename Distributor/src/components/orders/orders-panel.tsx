"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Layers3, XCircle } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import {
  paginateTableItems,
  Table,
} from "@/components/application/table";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageShell } from "@/components/dashboard/distributor-page-shell";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { StatusBadge } from "@/components/ui/status-badge";
import { DUMMY_ORDERS } from "@/lib/dummy/orders";
import type { OrderStatus } from "@/lib/dummy/types";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { orderStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const TABLE_MIN_CLASS = "min-w-[var(--table-min-width-4xl)]";

const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "Pending", label: "Pending" },
  { value: "Processing", label: "Processing" },
  { value: "Completed", label: "Completed" },
  { value: "Failed", label: "Failed" },
];

type OrdersPanelProps = DistributorPageConfig & {
  layout?: "page" | "table";
};

export function OrdersPanel({
  iconName,
  title,
  description,
  layout = "page",
}: OrdersPanelProps) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  const filtered = useMemo(() => {
    if (statusFilter === "all") return DUMMY_ORDERS;
    return DUMMY_ORDERS.filter((order) => order.status === statusFilter);
  }, [statusFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, totalPages, safePage } = useMemo(
    () => paginateTableItems(sorted, page, PAGE_SIZE),
    [sorted, page],
  );

  const pendingCount = DUMMY_ORDERS.filter(
    (o) => o.status === "Pending" || o.status === "Processing",
  ).length;
  const completedCount = DUMMY_ORDERS.filter((o) => o.status === "Completed").length;
  const failedCount = DUMMY_ORDERS.filter((o) => o.status === "Failed").length;

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setStatusFilter("all");
        setPage(1);
      }}
      clearDisabled={statusFilter === "all"}
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
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label="Orders"
      className={TABLE_MIN_CLASS}
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={{
        page: safePage,
        totalPages,
        onPageChange: setPage,
      }}
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

  if (layout === "table") {
    return (
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle="No orders match your filters"
        emptyDescription="Adjust the status filter or clear all to reset."
      >
        {table}
      </DistributorTableOnlyShell>
    );
  }

  return (
    <DistributorPageShell
      iconName={iconName}
      title={title}
      description={description}
      isEmpty={sorted.length === 0}
      emptyTitle="No orders match your filters"
      emptyDescription="Adjust the status filter or clear all to reset."
      metrics={
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DistributorMetricCard
            icon={Layers3}
            label="Total orders"
            value={String(DUMMY_ORDERS.length)}
            hint="In demo book"
          />
          <DistributorMetricCard
            icon={Clock3}
            label="Open"
            value={String(pendingCount)}
            hint="Pending or processing"
          />
          <DistributorMetricCard
            icon={CheckCircle2}
            label="Completed"
            value={String(completedCount)}
            hint="Successfully processed"
          />
          <DistributorMetricCard
            icon={XCircle}
            label="Failed"
            value={String(failedCount)}
            hint="Needs follow-up"
          />
        </div>
      }
      toolbar={toolbar}
    >
      {table}
    </DistributorPageShell>
  );
}
