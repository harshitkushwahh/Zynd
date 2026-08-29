"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FolderKanban, Layers, Send } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorMetricCard } from "@/components/dashboard/distributor-metric-card";
import { DistributorPageShell } from "@/components/dashboard/distributor-page-shell";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { useDistributorTxnRequests } from "@/contexts/distributor-txn-requests-context";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import {
  getScopedTransactionGroups,
  type DistributorOrdersListScope,
} from "@/lib/distributor-operations-orders-scope";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { transactionGroupVariantId } from "@/lib/map-mitra-txn-recommendation";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { DistributorTransactionGroup } from "@/lib/distributor-types";
import { DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS } from "@/lib/distributor-layout";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";

type GroupStatus = DistributorTransactionGroup["status"];

const STATUS_OPTIONS: Array<{ value: GroupStatus; label: string }> = [
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Completed", label: "Completed" },
];

type InvestorSizeFilter = "all" | "compact" | "standard" | "large";

const INVESTOR_SIZE_OPTIONS: Array<{ value: Exclude<InvestorSizeFilter, "all">; label: string }> = [
  { value: "compact", label: "1–2 investors" },
  { value: "standard", label: "3–4 investors" },
  { value: "large", label: "5+ investors" },
];

function groupMatchesInvestorSize(count: number, filter: InvestorSizeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "compact") return count <= 2;
  if (filter === "standard") return count >= 3 && count <= 4;
  return count >= 5;
}

function groupStatusVariant(status: GroupStatus): StatusBadgeVariant {
  if (status === "Completed") return "success";
  if (status === "Submitted") return "info";
  return "neutral";
}

type TransactionGroupsPanelProps = DistributorPageConfig & {
  layout?: "page" | "table";
  operationsListScope?: DistributorOrdersListScope;
  operationsVariantId?: string;
};

const TABLE_MIN_CLASS = "w-full min-w-[var(--table-min-width-xl)]";

export function TransactionGroupsPanel({
  title,
  description,
  layout = "page",
  operationsListScope = "your-book",
  operationsVariantId,
}: TransactionGroupsPanelProps) {
  const { transactionGroups: allGroups } = useDistributorTxnRequests();
  const sourceGroups = useMemo(
    () => getScopedTransactionGroups(allGroups, operationsListScope),
    [allGroups, operationsListScope],
  );
  const variantScoped = useMemo(() => {
    if (!operationsVariantId) return sourceGroups;
    return sourceGroups.filter(
      (group) => transactionGroupVariantId(group) === operationsVariantId,
    );
  }, [operationsVariantId, sourceGroups]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<GroupStatus | "all">("all");
  const [investorSizeFilter, setInvestorSizeFilter] = useState<InvestorSizeFilter>("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  const filtered = useMemo(() => {
    return variantScoped.filter((group) => {
      if (statusFilter !== "all" && group.status !== statusFilter) return false;
      if (!groupMatchesInvestorSize(group.investorCount, investorSizeFilter)) return false;
      return distributorTableSearchMatch(
        searchQuery,
        group.groupRef,
        group.label,
        String(group.investorCount),
        String(group.legCount),
      );
    });
  }, [investorSizeFilter, searchQuery, statusFilter, variantScoped]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const draftCount = variantScoped.filter((g) => g.status === "Draft").length;
  const submittedCount = variantScoped.filter((g) => g.status === "Submitted").length;
  const completedCount = variantScoped.filter((g) => g.status === "Completed").length;

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setStatusFilter("all");
        setInvestorSizeFilter("all");
        setPage(1);
      }}
      clearDisabled={
        statusFilter === "all" &&
        investorSizeFilter === "all" &&
        searchQuery.trim() === ""
      }
      search={
        <DistributorTableSearchCard
          variant="card"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search groups…"
          aria-label="Search transaction groups"
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
        label="Investors"
        value={investorSizeFilter}
        options={INVESTOR_SIZE_OPTIONS}
        onValueChange={(value) => {
          setInvestorSizeFilter(value);
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
        pagination={pagination}
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
            <Table.Row id={group.id}>
              <Table.Cell className="font-mono text-compact font-medium">
                {group.groupRef}
              </Table.Cell>
              <Table.Cell className="text-right text-compact tabular-nums">
                {group.investorCount}
              </Table.Cell>
              <Table.Cell className="text-right text-compact tabular-nums">
                {group.legCount}
              </Table.Cell>
              <Table.Cell className="text-right text-compact tabular-nums">
                {formatAum(group.totalAmount)}
              </Table.Cell>
              <Table.Cell>
                <StatusBadge variant={groupStatusVariant(group.status)}>{group.status}</StatusBadge>
              </Table.Cell>
              <Table.Cell
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
        emptyDescription="Adjust filters, search, or clear all to reset."
        tableSize="md"
      >
        {table}
      </DistributorTableOnlyShell>
    );
  }

  return (
    <DistributorPageShell
      title={title}
      description={description}
      tableSize="md"
      isEmpty={sorted.length === 0}
      emptyTitle="No groups match your filters"
      emptyDescription="Adjust filters, search, or clear all to reset."
      metrics={
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DistributorMetricCard
            icon={FolderKanban}
            label="Total groups"
            value={String(variantScoped.length)}
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
