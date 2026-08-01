"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortDescriptor } from "react-aria-components";

import { BranchDistributorsMetrics } from "@/components/dist-management/branch-distributors-metrics";
import { BranchDistributorsPageSkeleton } from "@/components/dist-management/branch-distributors-page-skeleton";
import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { useDistributorScopePageReveal } from "@/components/dashboard/use-distributor-scope-page-reveal";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { DistributorPageConfig } from "@/lib/distributor-page-config";
import {
  DUMMY_BRANCH_DISTRIBUTORS,
  type BranchDistributorRecord,
  type BranchDistributorStatus,
} from "@/lib/dummy/branch-distributors";
import { branchDistributorDetailHref } from "@/lib/dummy/branch-distributor-profile";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const STATUS_OPTIONS: Array<{ value: BranchDistributorStatus; label: string }> = [
  { value: "Active", label: "Active" },
  { value: "Former", label: "Former" },
  { value: "Paused", label: "Paused" },
];

type ClientsFilter = "all" | "large-book" | "growing-book";

const CLIENTS_FILTER_OPTIONS: Array<{ value: ClientsFilter; label: string }> = [
  { value: "large-book", label: "50+ clients" },
  { value: "growing-book", label: "Under 50 clients" },
];

function statusVariant(status: BranchDistributorStatus): StatusBadgeVariant {
  if (status === "Active") return "success";
  if (status === "Paused") return "warning";
  return "neutral";
}

export function BranchDistributorsPanel({ title, description }: DistributorPageConfig) {
  const router = useRouter();
  const { loading: authLoading } = useDistributorAuth();
  const { showSkeleton } = useDistributorScopePageReveal({ ready: !authLoading });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BranchDistributorStatus | "all">("all");
  const [clientsFilter, setClientsFilter] = useState<ClientsFilter>("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "name",
    direction: "ascending",
  });

  const filtered = useMemo(() => {
    return DUMMY_BRANCH_DISTRIBUTORS.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (clientsFilter === "large-book" && row.clientCount < 50) return false;
      if (clientsFilter === "growing-book" && row.clientCount >= 50) return false;
      return distributorTableSearchMatch(
        searchQuery,
        row.name,
        row.email,
        row.arn,
        row.status,
      );
    });
  }, [clientsFilter, searchQuery, statusFilter]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  const clearDisabled =
    searchQuery.trim() === "" && statusFilter === "all" && clientsFilter === "all";

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearchQuery("");
        setStatusFilter("all");
        setClientsFilter("all");
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
          placeholder={ZYND_MITRA_COPY.searchPlaceholder}
          aria-label={ZYND_MITRA_COPY.searchAria}
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
        label="Book size"
        value={clientsFilter}
        options={CLIENTS_FILTER_OPTIONS}
        onValueChange={(value) => {
          setClientsFilter(value);
          setPage(1);
        }}
      />
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label={ZYND_MITRA_COPY.branchListAria}
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="name" label="Name" isRowHeader allowsSorting />
        <Table.Head id="email" label="Email" allowsSorting />
        <Table.Head id="arn" label="ARN" allowsSorting />
        <Table.Head id="clientCount" label="Clients" allowsSorting className="text-right [&>div]:justify-end" />
        <Table.Head id="aum" label="AUM" allowsSorting className="text-right [&>div]:justify-end" />
        <Table.Head id="status" label="Status" allowsSorting />
        <Table.Head id="joinedAt" label="Joined" allowsSorting />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(row: BranchDistributorRecord) => (
          <Table.Row
            id={row.id}
            className="cursor-pointer"
            onAction={() => router.push(branchDistributorDetailHref(row.id))}
          >
            <Table.Cell className="font-medium">{row.name}</Table.Cell>
            <Table.Cell>{row.email}</Table.Cell>
            <Table.Cell className="font-mono text-caption">{row.arn}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{row.clientCount}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatAum(row.aum)}</Table.Cell>
            <Table.Cell>
              <StatusBadge variant={statusVariant(row.status)}>{row.status}</StatusBadge>
            </Table.Cell>
            <Table.Cell>{formatDistributorDate(row.joinedAt)}</Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  if (showSkeleton) {
    return <BranchDistributorsPageSkeleton />;
  }

  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-scope-page--enter")}>
      <DistributorPageHeader title={title} description={description} />
      <BranchDistributorsMetrics />
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={pageItems.length === 0}
        emptyTitle={ZYND_MITRA_COPY.emptyFiltered}
        emptyDescription="Adjust status, book size, or search to reset."
        tableSize="md"
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
