"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Clock3, Wallet } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import {
  BranchDistributorSquareCardGrid,
  BranchDistributorSquareMetricCard,
} from "@/components/dist-management/branch-distributor-square-card";
import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { BranchDistributorProfile } from "@/lib/distributor-branch-distributor-profile-data";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import type { DistributorOrder, OrderStatus } from "@/lib/distributor-types";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { orderStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

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

type BranchDistributorTransactionsPanelProps = {
  profile: BranchDistributorProfile;
  orders: DistributorOrder[];
  className?: string;
};

export function BranchDistributorTransactionsPanel({
  profile,
  orders,
  className,
}: BranchDistributorTransactionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  const pendingCount = useMemo(
    () => orders.filter((order) => order.status === "Pending" || order.status === "Processing").length,
    [orders],
  );
  const completedCount = useMemo(
    () => orders.filter((order) => order.status === "Completed").length,
    [orders],
  );
  const orderVolume = useMemo(
    () => orders.reduce((sum, order) => sum + order.amount, 0),
    [orders],
  );

  const filtered = useMemo(() => {
    return orders.filter((order) => {
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
  }, [orders, searchQuery, statusFilter, typeFilter]);

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
          placeholder="Search transactions…"
          aria-label="Search transactions"
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
      aria-label={ZYND_MITRA_COPY.bookTransactionsAria}
      className="min-w-[var(--table-min-width-4xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="orderRef" label="Order" isRowHeader allowsSorting />
        <Table.Head id="clientCode" label="Client" allowsSorting />
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
            </Table.Cell>
            <Table.Cell className="font-mono text-caption">{order.clientCode}</Table.Cell>
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

  return (
    <div
      className={cn("distributor-branch-distributor-transactions-panel flex flex-col gap-4", className)}
    >
      <BranchDistributorSquareCardGrid columns={4}>
        <BranchDistributorSquareMetricCard
          icon={ArrowLeftRight}
          label="Transactions"
          value={String(orders.length)}
          hint="In demo sample"
          tone="accent"
        />
        <BranchDistributorSquareMetricCard
          icon={Clock3}
          label="In progress"
          value={String(pendingCount)}
          hint="Pending or processing"
          tone="soft"
        />
        <BranchDistributorSquareMetricCard
          icon={CheckCircle2}
          label="Completed"
          value={String(completedCount)}
          hint={
            orders.length - completedCount === 1
              ? "1 other status"
              : `${orders.length - completedCount} other statuses`
          }
        />
        <BranchDistributorSquareMetricCard
          icon={Wallet}
          label="Sample volume"
          value={formatAum(orderVolume)}
          hint={`MTD inflow ${formatAum(profile.mtdInflow)}`}
        />
      </BranchDistributorSquareCardGrid>

      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle="No transactions match your filters"
        emptyDescription="Adjust filters, search, or clear all to reset."
        tableSize="md"
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
