"use client";

import { useEffect, useState } from "react";

import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PortfolioRedeemUnitsSkeleton } from "@/features/dashboard/portfolio/components/portfolio-redeem-units-skeleton";
import { Table, TableCard } from "@/components/core/table";
import {
  PORTFOLIO_REDEEM_JOURNEY_DIALOG_CLOSE_MS,
  PortfolioRedeemUnitsJourneyDialog,
} from "@/features/dashboard/portfolio/components/portfolio-redeem-units-journey-dialog";
import { PortfolioTabEmptyState } from "@/features/dashboard/portfolio/components/portfolio-tab-empty-state";
import { usePortfolioRedeemUnitsQuery } from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { usePortfolioUninvestedEmpty } from "@/features/dashboard/portfolio/hooks/use-portfolio-uninvested-empty";
import { getPortfolioTabMeta } from "@/features/dashboard/portfolio/lib/portfolio-page-tab-meta";
import type { PortfolioRedeemUnitsRow } from "@/features/dashboard/portfolio/lib/portfolio-redeem-mapper";
import { portfolioHoldingAmcInitials } from "@/features/dashboard/portfolio/lib/portfolio-types";
import { formatInr } from "@/features/invest/lib/mf-format";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const TABLE_LAYOUT_CLASS = "w-full min-w-[640px] table-fixed border-collapse border-spacing-0";
const COL_FUND = "w-[46%]";
const COL_UNITS = "w-[27%]";
const COL_VALUE = "w-[27%]";
const HEADER_ROW_CLASS =
  "sticky top-0 z-10 !h-auto !bg-transparent [&>tr>th]:after:!hidden [&>tr]:border-b [&>tr]:border-border";
const HEADER_CELL_CLASS = "px-4 py-3.5 md:px-5";
const BODY_CELL_CLASS = "px-4 md:px-5";
const HEADER_SURFACE_CLASS = "bg-muted/30";
const HEADER_LABEL_CLASS =
  "[&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-muted-foreground";
const RIGHT_HEAD_CLASS = "text-right [&>div]:ml-auto [&>div]:justify-end";

export function PortfolioRedeemUnitsPanel() {
  const portfolioCopy = copy.dashboard.portfolio;
  const redeemTabMeta = getPortfolioTabMeta("redeem-units");
  const uninvested = usePortfolioUninvestedEmpty();
  const { rows, showSkeleton, hasResolved, errorMessage, isFetching, refetch } = usePortfolioRedeemUnitsQuery();
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PortfolioRedeemUnitsRow | null>(null);

  useEffect(() => {
    if (journeyOpen) return;

    const timer = window.setTimeout(() => {
      setSelectedRow(null);
    }, PORTFOLIO_REDEEM_JOURNEY_DIALOG_CLOSE_MS);

    return () => window.clearTimeout(timer);
  }, [journeyOpen]);

  function handleRowOpen(row: PortfolioRedeemUnitsRow) {
    setSelectedRow(row);
    setJourneyOpen(true);
  }

  if (!uninvested.hasResolved && showSkeleton) {
    return <PortfolioRedeemUnitsSkeleton />;
  }

  if (!uninvested.hasInvestments && uninvested.hasResolved) {
    return (
      <PortfolioTabEmptyState
        icon={redeemTabMeta.icon}
        title={portfolioCopy.redeemUnitsEmpty}
        description={
          uninvested.isProcessing
            ? portfolioCopy.redeemUnitsPendingAllotmentDescription
            : portfolioCopy.redeemUnitsEmptyDescription
        }
      />
    );
  }

  if (uninvested.hasInvestments && !hasResolved && showSkeleton) {
    return <PortfolioRedeemUnitsSkeleton />;
  }

  if (uninvested.hasInvestments && hasResolved && errorMessage) {
    return (
      <LoadErrorCard
        icon={redeemTabMeta.icon}
        title={portfolioCopy.redeemUnitsLoadFailed}
        description={errorMessage}
        retryLabel={portfolioCopy.retry}
        retryLoading={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }

  if (uninvested.hasInvestments && hasResolved && rows.length === 0) {
    return (
      <PortfolioTabEmptyState
        icon={redeemTabMeta.icon}
        title={portfolioCopy.redeemUnitsEmpty}
        description={portfolioCopy.redeemUnitsEmptyDescription}
      />
    );
  }

  return (
    <>
      <TableCard.Root
        size="sm"
        className={cn(ZYND_3XL_RADIUS_CLASS, "overflow-hidden border-border/60 shadow-zynd-low")}
      >
        <div className="overflow-x-auto overscroll-x-contain">
          <Table aria-label={portfolioCopy.tabRedeemUnits} size="sm" className={TABLE_LAYOUT_CLASS}>
            <Table.Header bordered={false} className={HEADER_ROW_CLASS}>
              <Table.Head
                id="fund"
                isRowHeader
                className={cn(COL_FUND, HEADER_CELL_CLASS, HEADER_SURFACE_CLASS, HEADER_LABEL_CLASS)}
              >
                {portfolioCopy.redeemUnitsFund}
              </Table.Head>
              <Table.Head
                id="units"
                className={cn(
                  COL_UNITS,
                  HEADER_CELL_CLASS,
                  HEADER_SURFACE_CLASS,
                  HEADER_LABEL_CLASS,
                  RIGHT_HEAD_CLASS,
                )}
              >
                {portfolioCopy.redeemUnitsUnits}
              </Table.Head>
              <Table.Head
                id="value"
                className={cn(
                  COL_VALUE,
                  HEADER_CELL_CLASS,
                  HEADER_SURFACE_CLASS,
                  HEADER_LABEL_CLASS,
                  RIGHT_HEAD_CLASS,
                )}
              >
                {portfolioCopy.redeemUnitsValue}
              </Table.Head>
            </Table.Header>

            <Table.Body className="[&>tr:first-child>td]:border-t-0" items={rows}>
              {(holding) => (
                <Table.Row
                  id={holding.id}
                  className="cursor-pointer"
                  onAction={() => handleRowOpen(holding)}
                >
                  <Table.Cell className={cn(COL_FUND, BODY_CELL_CLASS)}>
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
                  </Table.Cell>
                  <Table.Cell className={cn(COL_UNITS, BODY_CELL_CLASS, "text-right tabular-nums")}>
                    {holding.redeemableUnits.toFixed(3)}
                  </Table.Cell>
                  <Table.Cell className={cn(COL_VALUE, BODY_CELL_CLASS, "text-right tabular-nums font-medium")}>
                    {formatInr(holding.redeemableValueInr)}
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </TableCard.Root>

      <PortfolioRedeemUnitsJourneyDialog
        open={journeyOpen}
        row={selectedRow}
        onOpenChange={setJourneyOpen}
      />
    </>
  );
}
