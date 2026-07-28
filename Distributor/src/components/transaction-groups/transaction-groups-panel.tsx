"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FolderKanban, Layers, Send } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { paginateTableItems, Table } from "@/components/application/table";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageShell } from "@/components/dashboard/distributor-page-shell";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import { DUMMY_TRANSACTION_GROUPS } from "@/lib/dummy/transaction-groups";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";

type GroupStatus = (typeof DUMMY_TRANSACTION_GROUPS)[number]["status"];

const STATUS_OPTIONS: Array<{ value: GroupStatus; label: string }> = [
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Completed", label: "Completed" },
];

function groupStatusVariant(status: GroupStatus): StatusBadgeVariant {
  if (status === "Completed") return "success";
  if (status === "Submitted") return "info";
  return "neutral";
}

type TransactionGroupsPanelProps = DistributorPageConfig & {
  layout?: "page" | "table";
};

const TABLE_MIN_CLASS = "w-full min-w-[var(--table-min-width-xl)]";

export function TransactionGroupsPanel({
  iconName,
  title,
  description,
  layout = "page",
}: TransactionGroupsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<GroupStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  const filtered = useMemo(() => {
    if (statusFilter === "all") return DUMMY_TRANSACTION_GROUPS;
    return DUMMY_TRANSACTION_GROUPS.filter((group) => group.status === statusFilter);
  }, [statusFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, totalPages, safePage } = useMemo(
    () => paginateTableItems(sorted, page),
    [sorted, page],
  );

  const draftCount = DUMMY_TRANSACTION_GROUPS.filter((g) => g.status === "Draft").length;
  const submittedCount = DUMMY_TRANSACTION_GROUPS.filter((g) => g.status === "Submitted").length;
  const completedCount = DUMMY_TRANSACTION_GROUPS.filter((g) => g.status === "Completed").length;

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
        aria-label="Transaction groups"
        size="md"
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
        <Table.Header size="md">
          <Table.Head id="groupRef" label="Group" isRowHeader allowsSorting />
          <Table.Head
            id="investorCount"
            label="Investors"
            allowsSorting
            className="text-right [&>div]:justify-end"
          />
          <Table.Head
            id="legCount"
            label="Legs"
            allowsSorting
            className="text-right [&>div]:justify-end"
          />
          <Table.Head
            id="totalAmount"
            label="Total"
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
          {(group) => (
            <Table.Row id={group.id} size="md">
              <Table.Cell size="md" className="font-mono text-compact font-medium">
                {group.groupRef}
              </Table.Cell>
              <Table.Cell size="md" className="text-right text-compact tabular-nums">
                {group.investorCount}
              </Table.Cell>
              <Table.Cell size="md" className="text-right text-compact tabular-nums">
                {group.legCount}
              </Table.Cell>
              <Table.Cell size="md" className="text-right text-compact tabular-nums">
                {formatAum(group.totalAmount)}
              </Table.Cell>
              <Table.Cell size="md">
                <StatusBadge variant={groupStatusVariant(group.status)}>{group.status}</StatusBadge>
              </Table.Cell>
              <Table.Cell
                size="md"
                className={cn("text-compact text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}
              >
                {formatDistributorDate(group.createdAt)}
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
        emptyTitle="No groups match your filters"
        emptyDescription="Adjust the status filter or clear all to reset."
        tableSize="md"
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
      tableSize="md"
      isEmpty={sorted.length === 0}
      emptyTitle="No groups match your filters"
      emptyDescription="Adjust the status filter or clear all to reset."
      metrics={
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DistributorMetricCard
            icon={FolderKanban}
            label="Total groups"
            value={String(DUMMY_TRANSACTION_GROUPS.length)}
            hint="Multi-leg batches"
          />
          <DistributorMetricCard
            icon={Layers}
            label="Draft"
            value={String(draftCount)}
            hint="Not yet submitted"
          />
          <DistributorMetricCard
            icon={Send}
            label="Submitted"
            value={String(submittedCount)}
            hint="In processing"
          />
          <DistributorMetricCard
            icon={CheckCircle2}
            label="Completed"
            value={String(completedCount)}
            hint="Fully processed"
          />
        </div>
      }
      toolbar={toolbar}
    >
      {table}
    </DistributorPageShell>
  );
}
