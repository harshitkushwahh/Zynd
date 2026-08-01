"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TrendingUp, UserCheck, Users, Wallet } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import {
  BranchDistributorSquareCardGrid,
  BranchDistributorSquareMetricCard,
} from "@/components/dist-management/branch-distributor-square-card";
import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { InvestorTableToolbar } from "@/components/investors/investor-table-toolbar";
import {
  applyInvestorTableFilters,
  DEFAULT_INVESTOR_TABLE_FILTERS,
  investorFiltersAreDefault,
  type InvestorTableFilters,
} from "@/components/investors/investor-filters";
import { StatusBadge } from "@/components/ui/status-badge";
import type { BranchDistributorProfile } from "@/lib/dummy/branch-distributor-profile";
import {
  distributorClientDetailHref,
  getDistributorClientProfile,
} from "@/lib/dummy/client-profile";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import type { DistributorInvestor } from "@/lib/dummy/types";
import { formatAum } from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { investmentStatusVariant, onboardingStatusVariant } from "@/lib/status-meta";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type BranchDistributorClientsPanelProps = {
  profile: BranchDistributorProfile;
  investors: DistributorInvestor[];
  className?: string;
};

type BranchDistributorClientRow = DistributorInvestor & {
  displayName: string;
};

function toClientRows(investors: DistributorInvestor[]): BranchDistributorClientRow[] {
  return investors.map((investor) => ({
    ...investor,
    displayName: getDistributorClientProfile(investor.id)?.displayName ?? investor.clientCode,
  }));
}

export function BranchDistributorClientsPanel({
  profile,
  investors,
  className,
}: BranchDistributorClientsPanelProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<InvestorTableFilters>(DEFAULT_INVESTOR_TABLE_FILTERS);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "clientCode",
    direction: "ascending",
  });

  const onboardedCount = useMemo(
    () => investors.filter((row) => row.onboardingStatus === "Onboarded").length,
    [investors],
  );
  const investedCount = useMemo(
    () => investors.filter((row) => row.investmentStatus === "Invested").length,
    [investors],
  );
  const compliantCount = useMemo(
    () => investors.filter((row) => row.complianceStatus === "Compliant").length,
    [investors],
  );

  const rows = useMemo(() => toClientRows(investors), [investors]);

  const filtered = useMemo(
    () => applyInvestorTableFilters(rows, filters),
    [filters, rows],
  );

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);
  const clearDisabled = investorFiltersAreDefault(filters);

  const toolbar = (
    <InvestorTableToolbar
      filters={filters}
      onChange={(next) => {
        setFilters(next);
        setPage(1);
      }}
      onClearAll={() => {
        setFilters(DEFAULT_INVESTOR_TABLE_FILTERS);
        setPage(1);
      }}
      clearDisabled={clearDisabled}
      showTypeFilter
    />
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label={ZYND_MITRA_COPY.mitraClientsAria}
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="displayName" label="Name" isRowHeader allowsSorting />
        <Table.Head id="clientCode" label="Client code" allowsSorting />
        <Table.Head id="investorType" label="Type" allowsSorting />
        <Table.Head
          id="aum"
          label="AUM"
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head id="onboardingStatus" label="Onboarding" allowsSorting />
        <Table.Head id="investmentStatus" label="Invested" allowsSorting />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(investor) => {
          const origin = investor.inDistributorBook ? "your-book" : "system-resident";
          const href = distributorClientDetailHref(origin, investor.id);

          return (
            <Table.Row
              id={investor.id}
              className="cursor-pointer"
              onAction={() => router.push(href)}
            >
              <Table.Cell>
                <Link href={href} className="font-medium text-foreground hover:underline">
                  {investor.displayName}
                </Link>
              </Table.Cell>
              <Table.Cell className="font-mono text-caption">{investor.clientCode}</Table.Cell>
              <Table.Cell className="text-muted-foreground">{investor.investorType}</Table.Cell>
              <Table.Cell className="text-right tabular-nums">
                {investor.aum != null && investor.aum > 0 ? formatAum(investor.aum) : "—"}
              </Table.Cell>
              <Table.Cell>
                <StatusBadge variant={onboardingStatusVariant(investor.onboardingStatus)}>
                  {investor.onboardingStatus}
                </StatusBadge>
              </Table.Cell>
              <Table.Cell>
                <StatusBadge variant={investmentStatusVariant(investor.investmentStatus)}>
                  {investor.investmentStatus}
                </StatusBadge>
              </Table.Cell>
            </Table.Row>
          );
        }}
      </Table.Body>
    </Table>,
  );

  return (
    <div className={cn("distributor-branch-distributor-clients-panel flex flex-col gap-4", className)}>
      <BranchDistributorSquareCardGrid columns={4}>
        <BranchDistributorSquareMetricCard
          icon={Users}
          label="Clients"
          value={String(profile.clientCount)}
          hint={`${profile.onboardingCompletePct}% onboarded`}
          tone="accent"
        />
        <BranchDistributorSquareMetricCard
          icon={UserCheck}
          label="Onboarded"
          value={String(onboardedCount)}
          hint={`${investors.length} in demo sample`}
          tone="soft"
        />
        <BranchDistributorSquareMetricCard
          icon={TrendingUp}
          label="Invested"
          value={String(investedCount)}
          hint={
            investors.length - investedCount === 1
              ? "1 not invested yet"
              : `${investors.length - investedCount} not invested yet`
          }
        />
        <BranchDistributorSquareMetricCard
          icon={Wallet}
          label="Book AUM"
          value={formatAum(profile.aum)}
          hint={`${compliantCount} compliant in sample`}
        />
      </BranchDistributorSquareCardGrid>

      <DistributorTableOnlyShell
        toolbar={toolbar}
        isEmpty={sorted.length === 0}
        emptyTitle="No clients match your filters"
        emptyDescription="Adjust filters or clear all to reset the list."
        tableSize="md"
      >
        {table}
      </DistributorTableOnlyShell>
    </div>
  );
}
