"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SortDescriptor } from "react-aria-components";

import { Table, TableCard } from "@/components/core/table";
import type { MfOrder, MfSipPlan } from "@/features/invest/api/invest-api";
import {
  formatHoldingSipPoolSummary,
  poolSipsForHolding,
} from "@/features/dashboard/portfolio/lib/portfolio-holding-sip";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import {
  portfolioHoldingDetailHref,
  portfolioUpcomingHoldingDetailHref,
  portfolioUpcomingHoldingSlug,
} from "@/features/dashboard/portfolio/lib/portfolio-holding-detail-data";
import {
  type PortfolioHoldingItem,
} from "@/features/dashboard/portfolio/lib/portfolio-types";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type PortfolioHoldingTableRow = PortfolioHoldingItem & {
  kind: "holding";
  tableId: string;
  returnInr: number;
};

type PortfolioUpcomingTableRow = {
  kind: "upcoming";
  tableId: string;
  order: MfOrder;
};

type PortfolioHoldingsTableRow = PortfolioHoldingTableRow | PortfolioUpcomingTableRow;

type PortfolioHoldingsTableProps = {
  holdings: PortfolioHoldingItem[];
  upcomingOrders?: MfOrder[];
  sipPlans?: MfSipPlan[];
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

function HoldingFundCell({
  holding,
  sipPlans = [],
}: {
  holding: PortfolioHoldingTableRow;
  sipPlans?: MfSipPlan[];
}) {
  const sipPool = poolSipsForHolding(
    { fundName: holding.fundName, isin: holding.isin },
    sipPlans,
  );
  const sipSummary = sipPool ? formatHoldingSipPoolSummary(sipPool) : null;

  return (
    <div className="flex min-w-0 items-start gap-3">
      <MfFundAmcAvatar
        amcLogoUrl={holding.amcLogoUrl}
        amcName={holding.amcName}
        size="sm"
        className="mt-0.5 shrink-0 rounded-[var(--radius-control)]"
      />
      <div className="min-w-0">
        <p className="font-medium leading-snug break-words whitespace-normal text-foreground">
          {holding.fundName}
        </p>
        <p className="mt-0.5 text-caption text-muted-foreground">{holding.amcName}</p>
        {sipSummary ? (
          <p className="mt-1 text-caption text-primary">
            {copy.dashboard.portfolio.holdingSipMonthlyTotal.replace("{amount}", sipSummary.monthly)}
            {sipSummary.nextDate
              ? ` · ${copy.dashboard.portfolio.holdingSipNextDebit.replace("{date}", sipSummary.nextDate)}`
              : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function UpcomingFundCell({ order }: { order: MfOrder }) {
  const amcName = order.amc_name ?? copy.mutualFunds.unknownAmc;

  return (
    <div className="flex min-w-0 items-start gap-3">
      <MfFundAmcAvatar
        amcLogoUrl={order.amc_logo_url}
        amcName={amcName}
        size="sm"
        className="mt-0.5 shrink-0 rounded-[var(--radius-control)]"
      />
      <div className="min-w-0">
        <p className="font-medium leading-snug break-words whitespace-normal text-foreground">
          {order.product_name ?? copy.mutualFunds.unknownFund}
        </p>
        <p className="mt-0.5 text-caption text-muted-foreground">{amcName}</p>
      </div>
    </div>
  );
}

function HoldingValueCell({ holding }: { holding: PortfolioHoldingTableRow }) {
  return (
    <div className="text-right">
      <p className="font-semibold tabular-nums text-foreground">{formatInr(holding.currentValueInr)}</p>
      <p className="mt-0.5 text-caption tabular-nums text-muted-foreground">
        {formatInr(holding.investedInr)}
      </p>
    </div>
  );
}

function UpcomingValueCell({ order }: { order: MfOrder }) {
  return (
    <div className="text-right">
      <p className="font-semibold tabular-nums text-foreground">{formatInr(order.amount_inr)}</p>
    </div>
  );
}

function HoldingReturnsCell({ holding }: { holding: PortfolioHoldingTableRow }) {
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

function UpcomingMetricCell() {
  const overview = copy.dashboard.overview;

  return (
    <div className="text-right">
      <p className="text-caption font-semibold uppercase tracking-wide text-warning">
        {overview.holdingsUpcomingLabel}
      </p>
    </div>
  );
}

function rowFundName(row: PortfolioHoldingsTableRow) {
  return row.kind === "holding"
    ? row.fundName
    : row.order.product_name ?? copy.mutualFunds.unknownFund;
}

function rowValueInr(row: PortfolioHoldingsTableRow) {
  return row.kind === "holding" ? row.currentValueInr : row.order.amount_inr;
}

function rowReturnPct(row: PortfolioHoldingsTableRow) {
  return row.kind === "holding" ? row.returnPct : -1;
}

function rowAllocationPct(row: PortfolioHoldingsTableRow) {
  return row.kind === "holding" ? row.allocationPct : -1;
}

export function PortfolioHoldingsTable({
  holdings,
  upcomingOrders = [],
  sipPlans = [],
  className,
}: PortfolioHoldingsTableProps) {
  const router = useRouter();
  const portfolioCopy = copy.dashboard.portfolio;
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor | undefined>(undefined);

  const rows = useMemo<PortfolioHoldingsTableRow[]>(() => {
    const holdingRows: PortfolioHoldingTableRow[] = holdings.map((holding) => ({
      kind: "holding",
      ...holding,
      tableId: holding.id,
      returnInr: holding.currentValueInr - holding.investedInr,
    }));

    const upcomingRows: PortfolioUpcomingTableRow[] = upcomingOrders.map((order) => ({
      kind: "upcoming",
      tableId: `upcoming:${portfolioUpcomingHoldingSlug(order)}`,
      order,
    }));

    return [...holdingRows, ...upcomingRows];
  }, [holdings, upcomingOrders]);

  const sortedRows = useMemo(() => {
    if (!sortDescriptor?.column) return rows;

    const column = sortDescriptor.column;
    const direction = sortDescriptor.direction === "descending" ? -1 : 1;

    return [...rows].sort((a, b) => {
      if (column === "fund") {
        return rowFundName(a).localeCompare(rowFundName(b)) * direction;
      }
      if (column === "value") {
        return (rowValueInr(a) - rowValueInr(b)) * direction;
      }
      if (column === "returns") {
        return (rowReturnPct(a) - rowReturnPct(b)) * direction;
      }
      if (column === "allocation") {
        return (rowAllocationPct(a) - rowAllocationPct(b)) * direction;
      }
      return 0;
    });
  }, [rows, sortDescriptor]);

  if (rows.length === 0) {
    return null;
  }

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
            aria-label={portfolioCopy.holdingsTitle}
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
                label={copy.dashboard.overview.portfolioCurrentValue}
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
                label={copy.dashboard.overview.portfolioReturns}
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
                label={copy.dashboard.overview.portfolioAllocationTitle}
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
              {(row) => (
                <Table.Row
                  id={row.tableId}
                  className={cn(
                    "cursor-pointer hover:bg-muted/30",
                    row.kind === "upcoming" && "bg-muted/15",
                  )}
                  onAction={() =>
                    router.push(
                      row.kind === "holding"
                        ? portfolioHoldingDetailHref(row.id)
                        : portfolioUpcomingHoldingDetailHref(row.order),
                    )
                  }
                >
                  <Table.Cell className={BODY_CELL_CLASS}>
                    {row.kind === "holding" ? (
                      <HoldingFundCell holding={row} sipPlans={sipPlans} />
                    ) : (
                      <UpcomingFundCell order={row.order} />
                    )}
                  </Table.Cell>
                  <Table.Cell className={BODY_CELL_CLASS}>
                    {row.kind === "holding" ? (
                      <HoldingValueCell holding={row} />
                    ) : (
                      <UpcomingValueCell order={row.order} />
                    )}
                  </Table.Cell>
                  <Table.Cell className={BODY_CELL_CLASS}>
                    {row.kind === "holding" ? <HoldingReturnsCell holding={row} /> : <UpcomingMetricCell />}
                  </Table.Cell>
                  <Table.Cell className={cn(BODY_CELL_CLASS, "text-right")}>
                    {row.kind === "holding" ? (
                      <p className="font-semibold tabular-nums text-foreground">
                        {row.allocationPct.toFixed(1)}%
                      </p>
                    ) : (
                      <UpcomingMetricCell />
                    )}
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
