"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";

import { ClientDetailEmptyState } from "@/components/clients/client-detail-empty-state";
import { Table, useDistributorTablePagination } from "@/components/application/table";
import { DistributorTableOnlyShell } from "@/components/dashboard/distributor-table-only-shell";
import { DistributorTableSearchCard } from "@/components/dashboard/distributor-table-search-card";
import { DistributorTableToolbar } from "@/components/dashboard/distributor-table-toolbar";
import { DistributorGrowthBadge } from "@/components/ui/distributor-growth-badge";
import { StatusFilterSelect } from "@/components/dashboard/status-filter-select";
import type { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { DISTRIBUTOR_CLIENT_COPY as CLIENT_COPY } from "@/lib/distributor-client-copy";
import { distributorTableSearchMatch } from "@/lib/distributor-table-search-match";
import { wrapDistributorTableBody } from "@/lib/distributor-table-wrap";
import type { DistributorClientHolding } from "@/lib/distributor-types";
import {
  formatAum,
  formatDistributorNav,
  formatDistributorUnits,
} from "@/lib/format";
import { sortByDescriptor } from "@/lib/sort-by-descriptor";
import { cn } from "@/lib/utils";

type PortfolioCopy = (typeof DISTRIBUTOR_CLIENT_COPY)["portfolio"];

type PortfolioHoldingRow = DistributorClientHolding & {
  returnsAmount: number;
  returnsPct: number;
};

function toHoldingRows(holdings: DistributorClientHolding[]): PortfolioHoldingRow[] {
  return holdings.map((holding) => {
    const hasCostBasis = holding.investedAmount > 0;
    const returnsAmount = hasCostBasis
      ? (holding.returnAmount ?? holding.currentValue - holding.investedAmount)
      : 0;
    const returnsPct = hasCostBasis
      ? (holding.returnPct ?? (returnsAmount / holding.investedAmount) * 100)
      : 0;
    return { ...holding, returnsAmount, returnsPct };
  });
}

function ReturnsCell({
  amount,
  pct,
  hasCostBasis,
}: {
  amount: number;
  pct: number;
  hasCostBasis: boolean;
}) {
  if (!hasCostBasis) {
    return <span className="text-muted-foreground">—</span>;
  }

  const positive = amount >= 0;
  return (
    <div className="flex flex-col items-end gap-1 text-right tabular-nums">
      <p
        className={cn(
          "text-compact font-medium",
          positive ? "text-[var(--distributor-growth-badge-fg)]" : "text-destructive",
        )}
      >
        {formatAum(amount)}
      </p>
      <DistributorGrowthBadge value={pct} showIcon={false} decimals={2} />
    </div>
  );
}

export function ClientPortfolioHoldingsList({
  holdings,
  copy,
  emptyMessage,
  emptyIcon: EmptyIcon,
  className,
}: {
  holdings: DistributorClientHolding[];
  copy: PortfolioCopy;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;
  className?: string;
}) {
  const rows = useMemo(() => toHoldingRows(holdings), [holdings]);

  const amcOptions = useMemo(() => {
    const names = new Set<string>();
    for (const holding of holdings) {
      const name = holding.amcName?.trim();
      if (name) names.add(name);
    }
    return [...names].sort().map((name) => ({ value: name, label: name }));
  }, [holdings]);

  const [search, setSearch] = useState("");
  const [amcFilter, setAmcFilter] = useState<string | "all">("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "schemeName",
    direction: "ascending",
  });

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (amcFilter !== "all" && row.amcName !== amcFilter) return false;
      return distributorTableSearchMatch(
        search,
        row.schemeName,
        row.amcName ?? "",
        row.folioNumber ?? "",
        row.isin ?? "",
      );
    });
  }, [amcFilter, rows, search]);

  const sorted = useMemo(
    () => sortByDescriptor(filtered, sortDescriptor),
    [filtered, sortDescriptor],
  );

  const { pageItems, pagination, setPage } = useDistributorTablePagination(sorted);

  if (holdings.length === 0) {
    return emptyMessage && EmptyIcon ? (
      <ClientDetailEmptyState message={emptyMessage} icon={EmptyIcon} />
    ) : null;
  }

  const toolbar = (
    <DistributorTableToolbar
      onClearAll={() => {
        setSearch("");
        setAmcFilter("all");
        setPage(1);
      }}
      clearDisabled={search.trim() === "" && amcFilter === "all"}
      search={
        <DistributorTableSearchCard
          variant="card"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder={copy.holdingsSearchPlaceholder}
          aria-label={copy.holdingsSearchPlaceholder}
        />
      }
    >
      {amcOptions.length > 0 ? (
        <StatusFilterSelect
          label={copy.holdingsAmcFilterLabel}
          value={amcFilter}
          options={amcOptions}
          onValueChange={(value) => {
            setAmcFilter(value);
            setPage(1);
          }}
        />
      ) : null}
    </DistributorTableToolbar>
  );

  const table = wrapDistributorTableBody(
    <Table
      aria-label={copy.holdingsTitle}
      className="min-w-[var(--table-min-width-3xl)]"
      sortDescriptor={sortDescriptor}
      onSortChange={(descriptor) => {
        setSortDescriptor(descriptor);
        setPage(1);
      }}
      pagination={pagination}
    >
      <Table.Header>
        <Table.Head id="schemeName" label={copy.holdingsColumnScheme} isRowHeader allowsSorting />
        <Table.Head
          id="units"
          label={copy.holdingsColumnUnits}
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="navPerUnit"
          label={copy.holdingsColumnNav}
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="investedAmount"
          label={copy.holdingsColumnInvested}
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="currentValue"
          label={copy.holdingsColumnCurrent}
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="redeemableValue"
          label={copy.holdingsColumnRedeemable}
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
        <Table.Head
          id="returnsAmount"
          label={copy.holdingsColumnReturns}
          allowsSorting
          className="text-right [&>div]:justify-end"
        />
      </Table.Header>
      <Table.Body items={pageItems}>
        {(holding) => {
          const navDisplay =
            holding.navPerUnit != null && holding.navPerUnit > 0
              ? formatDistributorNav(holding.navPerUnit)
              : "—";

          return (
            <Table.Row id={holding.id}>
              <Table.Cell>
                <span className="font-medium text-foreground">{holding.schemeName}</span>
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums text-muted-foreground">
                {formatDistributorUnits(holding.units)}
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums text-muted-foreground">
                {navDisplay}
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums">{formatAum(holding.investedAmount)}</Table.Cell>
              <Table.Cell className="text-right tabular-nums">{formatAum(holding.currentValue)}</Table.Cell>
              <Table.Cell className="text-right tabular-nums">{formatAum(holding.redeemableValue)}</Table.Cell>
              <Table.Cell>
                <ReturnsCell
                  amount={holding.returnsAmount}
                  pct={holding.returnsPct}
                  hasCostBasis={holding.investedAmount > 0}
                />
              </Table.Cell>
            </Table.Row>
          );
        }}
      </Table.Body>
    </Table>,
  );

  return (
    <DistributorTableOnlyShell
      className={cn("distributor-client-portfolio-holdings-table", className)}
      toolbar={toolbar}
      isEmpty={sorted.length === 0}
      emptyTitle={copy.holdingsEmptyFiltered}
      emptyDescription={CLIENT_COPY.activity.filtersEmptyDescription}
    >
      {table}
    </DistributorTableOnlyShell>
  );
}
