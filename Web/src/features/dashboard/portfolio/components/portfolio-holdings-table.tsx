"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortDescriptor } from "react-aria-components";

import { Table, TableCard } from "@/components/core/table";
import { portfolioHoldingDetailHref } from "@/features/dashboard/portfolio/lib/portfolio-holding-detail-data";
import {
  portfolioHoldingAmcInitials,
  type PortfolioHoldingItem,
} from "@/features/dashboard/portfolio/lib/portfolio-types";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type PortfolioHoldingsTableRow = PortfolioHoldingItem & {
  tableId: string;
  returnInr: number;
};

type PortfolioHoldingsTableProps = {
  holdings: PortfolioHoldingItem[];
  className?: string;
};

const TABLE_LAYOUT_CLASS = "w-full min-w-[760px] table-fixed border-collapse border-spacing-0";
const COL_FUND = "w-[38%]";
const COL_VALUE = "w-[22%]";
const COL_RETURNS = "w-[22%]";
const COL_ALLOCATION = "w-[18%]";
const HEADER_SURFACE_CLASS = "bg-muted/30";
const HEADER_ROW_CLASS =
  "sticky top-0 z-10 !h-auto !bg-transparent [&>tr>th]:after:!hidden [&>tr]:border-b [&>tr]:border-border";
const HEADER_CELL_CLASS = "px-4 py-3.5 md:px-5";
const BODY_CELL_CLASS = "px-4 md:px-5 align-top";
const HEADER_LABEL_CLASS =
  "[&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-muted-foreground";
const RIGHT_HEAD_CLASS = "text-right [&>div]:ml-auto [&>div]:justify-end";

function toneClass(tone: "positive" | "negative" | "muted") {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-destructive",
    tone === "muted" && "text-muted-foreground",
  );
}

function FundCell({ holding }: { holding: PortfolioHoldingsTableRow }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
        {portfolioHoldingAmcInitials(holding.amcName)}
      </div>
      <div className="min-w-0">
        <p className="font-medium leading-snug break-words whitespace-normal text-foreground">
          {holding.fundName}
        </p>
        <p className="mt-0.5 text-caption text-muted-foreground">{holding.amcName}</p>
      </div>
    </div>
  );
}

function ValueCell({ holding }: { holding: PortfolioHoldingsTableRow }) {
  return (
    <div className="text-right">
      <p className="font-semibold tabular-nums text-foreground">{formatInr(holding.currentValueInr)}</p>
      <p className="mt-0.5 text-caption tabular-nums text-muted-foreground">
        {formatInr(holding.investedInr)}
      </p>
    </div>
  );
}

function ReturnsCell({ holding }: { holding: PortfolioHoldingsTableRow }) {
  const returnDisplay = formatSignedReturn(holding.returnPct);

  return (
    <div className="text-right">
      <p className="font-medium tabular-nums text-foreground">{formatInr(holding.returnInr)}</p>
      <p className={cn("mt-0.5 text-caption font-medium tabular-nums", toneClass(returnDisplay.tone))}>
        {returnDisplay.text}
      </p>
    </div>
  );
}

export function PortfolioHoldingsTable({ holdings, className }: PortfolioHoldingsTableProps) {
  const router = useRouter();
  const overview = copy.dashboard.overview;
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor | undefined>(undefined);

  const rows = useMemo<PortfolioHoldingsTableRow[]>(
    () =>
      holdings.map((holding) => ({
        ...holding,
        tableId: holding.id,
        returnInr: holding.currentValueInr - holding.investedInr,
      })),
    [holdings],
  );

  const sortedRows = useMemo(() => {
    if (!sortDescriptor?.column) return rows;

    const column = sortDescriptor.column;
    const direction = sortDescriptor.direction === "descending" ? -1 : 1;

    return [...rows].sort((a, b) => {
      if (column === "fund") {
        return a.fundName.localeCompare(b.fundName) * direction;
      }
      if (column === "value") {
        return (a.currentValueInr - b.currentValueInr) * direction;
      }
      if (column === "returns") {
        return (a.returnPct - b.returnPct) * direction;
      }
      if (column === "allocation") {
        return (a.allocationPct - b.allocationPct) * direction;
      }
      return 0;
    });
  }, [rows, sortDescriptor]);

  return (
    <div className={cn("min-w-0 overflow-hidden", className)}>
      <TableCard.Root
        size="sm"
        className={cn(
          ZYND_3XL_RADIUS_CLASS,
          "overflow-hidden border-border/60 shadow-zynd-low",
        )}
      >
        <div className="overflow-x-auto overscroll-x-contain">
          <Table
            aria-label={overview.portfolioHoldingsCount}
            size="sm"
            className={TABLE_LAYOUT_CLASS}
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
          >
            <Table.Header bordered={false} className={HEADER_ROW_CLASS}>
              <Table.Head
                id="fund"
                isRowHeader
                allowsSorting
                className={cn(COL_FUND, HEADER_CELL_CLASS, HEADER_SURFACE_CLASS, HEADER_LABEL_CLASS)}
              >
                {copy.mySips.tableFund}
              </Table.Head>
              <Table.Head
                id="value"
                label={overview.portfolioCurrentValue}
                allowsSorting
                className={cn(
                  COL_VALUE,
                  HEADER_CELL_CLASS,
                  HEADER_SURFACE_CLASS,
                  HEADER_LABEL_CLASS,
                  RIGHT_HEAD_CLASS,
                )}
              />
              <Table.Head
                id="returns"
                label={overview.portfolioReturns}
                allowsSorting
                className={cn(
                  COL_RETURNS,
                  HEADER_CELL_CLASS,
                  HEADER_SURFACE_CLASS,
                  HEADER_LABEL_CLASS,
                  RIGHT_HEAD_CLASS,
                )}
              />
              <Table.Head
                id="allocation"
                label={overview.portfolioAllocationTitle}
                allowsSorting
                className={cn(
                  COL_ALLOCATION,
                  HEADER_CELL_CLASS,
                  HEADER_SURFACE_CLASS,
                  HEADER_LABEL_CLASS,
                  RIGHT_HEAD_CLASS,
                )}
              />
            </Table.Header>

            <Table.Body className="[&>tr:first-child>td]:border-t-0" items={sortedRows}>
              {(holding) => (
                <Table.Row
                  id={holding.tableId}
                  className="cursor-pointer hover:bg-muted/30"
                  onAction={() => router.push(portfolioHoldingDetailHref(holding.id))}
                >
                  <Table.Cell className={BODY_CELL_CLASS}>
                    <FundCell holding={holding} />
                  </Table.Cell>
                  <Table.Cell className={BODY_CELL_CLASS}>
                    <ValueCell holding={holding} />
                  </Table.Cell>
                  <Table.Cell className={BODY_CELL_CLASS}>
                    <ReturnsCell holding={holding} />
                  </Table.Cell>
                  <Table.Cell className={cn(BODY_CELL_CLASS, "text-right")}>
                    <p className="font-semibold tabular-nums text-foreground">
                      {holding.allocationPct.toFixed(1)}%
                    </p>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </TableCard.Root>
    </div>
  );
}
