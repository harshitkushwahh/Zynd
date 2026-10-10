"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortDescriptor } from "react-aria-components";

import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { YourClientsBookMetrics } from "@/components/workspace/your-clients-book-metrics";
import { Table } from "@/components/application/table/table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS,
  DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS,
  DISTRIBUTOR_PAGE_STACK_CLASS,
} from "@/lib/distributor-layout";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatDistributorDate } from "@/lib/format";
import { searchInvestors } from "@/lib/distributor-investor-utils";
import { SUPPORT_DUMMY_INVESTORS } from "@/lib/support-users-dummy-data";
import type { DistributorInvestor } from "@/lib/distributor-types";
import {
  complianceStatusVariant,
  investmentStatusVariant,
  onboardingStatusVariant,
} from "@/lib/status-meta";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";

function supportUserDetailHref(clientCode: string) {
  return `/dashboard/users/${encodeURIComponent(clientCode)}`;
}

export function SupportUsersBookPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "createdAt",
    direction: "descending",
  });

  const rows = useMemo(() => {
    const filtered = searchInvestors(SUPPORT_DUMMY_INVESTORS, search);
    return sortByDescriptor(filtered, sortDescriptor);
  }, [search, sortDescriptor]);

  const openUser = (investor: DistributorInvestor) => {
    router.push(supportUserDetailHref(investor.clientCode));
  };

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader title="Users" />

      <YourClientsBookMetrics listScope="your-book" />

      <DistributorTableOnlyShell
        isEmpty={rows.length === 0}
        emptyTitle="No users match your search"
        toolbar={
          <DistributorTableSearchCard
            value={search}
            onChange={setSearch}
            placeholder="Search clients…"
          />
        }
      >
        {wrapDistributorTableBody(
          <Table
            aria-label="Support users"
            className="min-w-[var(--table-min-width-5xl)]"
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
          >
            <Table.Header>
              <Table.Head id="displayName" label="User" isRowHeader allowsSorting />
              <Table.Head
                id="clientCode"
                label="Zynd ID"
                allowsSorting
                className={DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS}
              />
              <Table.Head id="onboardingStatus" label="Onboarding" allowsSorting />
              <Table.Head id="complianceStatus" label="KYC" allowsSorting />
              <Table.Head id="investmentStatus" label="Invested" allowsSorting />
              <Table.Head
                id="createdAt"
                label="Joined"
                allowsSorting
                className={DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS}
              />
            </Table.Header>
            <Table.Body items={rows}>
              {(investor) => (
                <Table.Row
                  id={investor.id}
                  className="cursor-pointer"
                  onAction={() => openUser(investor)}
                >
                  <Table.Cell>
                    <div className="min-w-0">
                      <p className="truncate text-compact font-medium text-foreground">
                        {investor.displayName}
                      </p>
                      <p className="truncate text-caption text-muted-foreground">{investor.emailMasked}</p>
                    </div>
                  </Table.Cell>
                  <Table.Cell className={cn("font-mono text-caption", DISTRIBUTOR_TABLE_CLIENT_CODE_COLUMN_CLASS)}>
                    {investor.clientCode}
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge variant={onboardingStatusVariant(investor.onboardingStatus)}>
                      {investor.onboardingStatus}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge variant={complianceStatusVariant(investor.complianceStatus)}>
                      {investor.complianceStatus}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge variant={investmentStatusVariant(investor.investmentStatus)}>
                      {investor.investmentStatus}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell className={cn("text-muted-foreground", DISTRIBUTOR_TABLE_CREATED_AT_COLUMN_CLASS)}>
                    {formatDistributorDate(investor.createdAt)}
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>,
        )}
      </DistributorTableOnlyShell>
    </div>
  );
}
