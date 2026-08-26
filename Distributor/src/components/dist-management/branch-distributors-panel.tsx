"use client";

import { useEffect, useMemo, useState } from "react";
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
  mapPartnerListItemToBranchRecord,
  type BranchDistributorRecord,
  type BranchDistributorStatus,
} from "@/lib/distributor-branch-distributors-data";
import { fetchDistributorPartners } from "@/lib/distributor-partners-api";
import { branchDistributorDetailHref } from "@/lib/distributor-branch-distributor-profile-data";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum, formatDistributorDate } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const STATUS_OPTIONS: Array<{ value: BranchDistributorStatus | "all"; label: string }> = [
  { value: "Active", label: "Active" },
  { value: "Pending review", label: "Pending review" },
  { value: "Pending password", label: "Pending password" },
  { value: "Rejected", label: "Rejected" },
  { value: "Former", label: "Former" },
  { value: "Paused", label: "Paused" },
];

function statusVariant(status: BranchDistributorStatus): StatusBadgeVariant {
  if (status === "Active") return "success";
  if (status === "Pending review" || status === "Pending password") return "warning";
  if (status === "Rejected") return "neutral";
  if (status === "Paused") return "warning";
  return "neutral";
}

type ClientsFilter = "all" | "large-book" | "growing-book";

const CLIENTS_FILTER_OPTIONS: Array<{ value: ClientsFilter; label: string }> = [
  { value: "large-book", label: "50+ clients" },
  { value: "growing-book", label: "Under 50 clients" },
];

export function BranchDistributorsPanel({ title, description }: DistributorPageConfig) {
  const router = useRouter();
  const { loading: authLoading } = useDistributorAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BranchDistributorStatus | "all">("all");
  const [clientsFilter, setClientsFilter] = useState<ClientsFilter>("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "name",
    direction: "ascending",
  });
  const [partners, setPartners] = useState<BranchDistributorRecord[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partnersError, setPartnersError] = useState("");
  const { showSkeleton } = useDistributorScopePageReveal({ ready: !authLoading && !partnersLoading });

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setPartnersLoading(true);
    setPartnersError("");
    void fetchDistributorPartners()
      .then((result) => {
        if (cancelled) return;
        setPartners(result.items.map(mapPartnerListItemToBranchRecord));
      })
      .catch(() => {
        if (cancelled) return;
        setPartners([]);
        setPartnersError("Could not load Zynd Mitras.");
      })
      .finally(() => {
        if (!cancelled) setPartnersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  const filtered = useMemo(() => {
    return partners.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (clientsFilter === "large-book" && row.clientCount < 50) return false;
      if (clientsFilter === "growing-book" && row.clientCount >= 50) return false;
      return distributorTableSearchMatch(
        searchQuery,
        row.name,
        row.email,
        row.arn,
        row.status,
        row.id,
      );
    });
  }, [clientsFilter, partners, searchQuery, statusFilter]);

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
        <Table.Head id="id" label="Zynd Mitra ID" allowsSorting />
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
            <Table.Cell className="font-mono text-caption">{row.id}</Table.Cell>
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
      <BranchDistributorsMetrics rows={partners} />
      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={pageItems.length === 0}
        emptyTitle={partnersError || ZYND_MITRA_COPY.emptyFiltered}
        emptyDescription={
          partnersError
            ? "Refresh the page or try again later."
            : "Onboard a Zynd Mitra or adjust filters to see results."
        }
        tableSize="md"
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
