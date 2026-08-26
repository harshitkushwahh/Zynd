"use client";

import { Table } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import type { BranchDistributorBookHolding } from "@/lib/distributor-branch-distributor-profile-data";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import { formatAum } from "@/lib/format";

type BranchDistributorBookHoldingsTableProps = {
  holdings: BranchDistributorBookHolding[];
  className?: string;
};

export function BranchDistributorBookHoldingsTable({
  holdings,
  className,
}: BranchDistributorBookHoldingsTableProps) {
  const table = wrapDistributorTableBody(
    <Table
      aria-label="Book portfolio by scheme"
      className="min-w-[var(--table-min-width-2xl)]"
    >
      <Table.Header>
        <Table.Head id="schemeName" label="Scheme" isRowHeader />
        <Table.Head
          id="totalAum"
          label="Book AUM"
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="clientCount"
          label="Clients"
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="sipSharePct"
          label="SIP share"
          className="text-right [&>div]:justify-end"
        />
      </Table.Header>
      <Table.Body items={holdings}>
        {(row) => (
          <Table.Row id={row.id}>
            <Table.Cell>
              <span className="block font-medium text-foreground">{row.schemeName}</span>
              <span className="block text-caption text-muted-foreground">{row.amcName}</span>
            </Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatAum(row.totalAum)}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{row.clientCount}</Table.Cell>
            <Table.Cell className="text-right tabular-nums">{row.sipSharePct}%</Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>,
  );

  return (
    <DistributorTableOnlyShell
      className={className}
      isEmpty={holdings.length === 0}
      emptyTitle="No book-level holdings yet"
      emptyDescription="AUM will appear once clients start investing."
      tableSize="md"
    >
      {table}
    </DistributorTableOnlyShell>
  );
}
