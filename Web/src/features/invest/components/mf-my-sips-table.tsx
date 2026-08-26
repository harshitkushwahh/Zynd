"use client";

import { useMemo, useState, type RefObject } from "react";
import type { SortDescriptor } from "react-aria-components";
import { Loader2 } from "lucide-react";

import { Table, TableCard } from "@/components/core/table";
import type { MfSipPlan } from "@/features/invest/api/invest-api";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { MfSipPlanStatusBadge } from "@/features/invest/components/mf-sip-plan-status-badge";
import { formatInr, formatSipNextInstallmentDate, formatSipScheduleSummary, isSipNextInstallmentNoData } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfMySipsTableRow = MfSipPlan & {
  tableId: string;
};

type MfMySipsTableProps = {
  plans: MfSipPlan[];
  totalCount: number;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  ariaLabel: string;
  className?: string;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  loadMoreRef?: RefObject<HTMLDivElement | null>;
  onPlanClick?: (plan: MfSipPlan) => void;
};

const TABLE_LAYOUT_CLASS = "w-full min-w-[720px] table-fixed border-collapse border-spacing-0";
const COL_FUND = "w-[34%]";
const COL_AMOUNT = "w-[14%]";
const COL_FREQUENCY = "w-[16%]";
const COL_NEXT = "w-[18%]";
const COL_STATUS = "w-[18%]";
const HEADER_SURFACE_CLASS =
  "bg-card/95 backdrop-blur-[var(--blur-sm)] supports-[backdrop-filter]:bg-card/80";
const HEADER_ROW_CLASS =
  "sticky top-0 z-10 !h-auto !bg-transparent [&>tr>th]:after:!hidden [&>tr]:border-b [&>tr]:border-border";
const HEADER_CELL_CLASS = "px-4 py-4 md:px-5";
const BODY_CELL_CLASS = "px-4 md:px-5";
const HEADER_LABEL_CLASS =
  "[&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground";

function formatFrequency(plan: MfSipPlan) {
  return formatSipScheduleSummary(plan);
}

function FundCell({ plan }: { plan: MfSipPlan }) {
  const amcName = plan.amc_name ?? copy.mutualFunds.unknownAmc;

  return (
    <div className="flex min-w-0 items-start gap-3">
      <MfFundAmcAvatar
        amcLogoUrl={plan.amc_logo_url}
        amcName={amcName}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <p className="font-medium leading-snug break-words whitespace-normal text-foreground">
          {plan.product_name ?? copy.mutualFunds.unknownFund}
        </p>
        <p className="mt-0.5 text-caption text-muted-foreground">{amcName}</p>
      </div>
    </div>
  );
}

export function MfMySipsTable({
  plans,
  totalCount,
  loading = false,
  loadingMore = false,
  hasMore = false,
  ariaLabel,
  className,
  scrollContainerRef,
  loadMoreRef,
  onPlanClick,
}: MfMySipsTableProps) {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "next",
    direction: "descending",
  });

  const rows = useMemo<MfMySipsTableRow[]>(
    () => plans.map((plan) => ({ ...plan, tableId: plan.plan_id })),
    [plans],
  );

  const sortedRows = useMemo(() => {
    const column = sortDescriptor.column;
    const direction = sortDescriptor.direction === "descending" ? -1 : 1;

    return [...rows].sort((a, b) => {
      if (column === "fund") {
        return (a.product_name ?? "").localeCompare(b.product_name ?? "") * direction;
      }
      if (column === "amount") {
        return (a.amount_inr - b.amount_inr) * direction;
      }
      if (column === "frequency") {
        return (a.frequency ?? "").localeCompare(b.frequency ?? "") * direction;
      }
      if (column === "next") {
        const aTime = a.next_installment_date ? new Date(a.next_installment_date).getTime() : 0;
        const bTime = b.next_installment_date ? new Date(b.next_installment_date).getTime() : 0;
        return (aTime - bTime) * direction;
      }
      if (column === "status") {
        return (a.status ?? "").localeCompare(b.status ?? "") * direction;
      }
      return 0;
    });
  }, [rows, sortDescriptor]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        {copy.mySips.loading}
      </div>
    );
  }

  if (sortedRows.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center px-6 text-center">
        <p className="text-compact text-muted-foreground">{copy.mySips.emptyFiltered}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <TableCard.Root
        size="sm"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 shadow-none"
      >
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-auto overscroll-y-contain overscroll-x-auto"
        >
          <Table
            aria-label={ariaLabel}
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
                className={cn(
                  COL_FUND,
                  HEADER_CELL_CLASS,
                  HEADER_SURFACE_CLASS,
                  "[&>div>span]:inline-flex [&>div>span]:flex-wrap [&>div>span]:items-baseline [&>div>span]:gap-x-1.5",
                )}
              >
                <span className="text-compact font-semibold tracking-tight text-foreground">
                  {copy.mySips.tableFund}
                </span>
                <span className="text-caption font-medium text-muted-foreground tabular-nums">
                  ({totalCount} results)
                </span>
              </Table.Head>
              <Table.Head
                id="amount"
                label={copy.mySips.tableAmount}
                allowsSorting
                className={cn(COL_AMOUNT, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
              <Table.Head
                id="frequency"
                label={copy.mySips.tableFrequency}
                allowsSorting
                className={cn(COL_FREQUENCY, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
              <Table.Head
                id="next"
                label={copy.mySips.tableNextInstallment}
                allowsSorting
                className={cn(COL_NEXT, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
              <Table.Head
                id="status"
                label={copy.mySips.tableStatus}
                allowsSorting
                className={cn(COL_STATUS, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
            </Table.Header>

            <Table.Body className="[&>tr:first-child>td]:border-t-0" items={sortedRows}>
              {(plan) => (
                <Table.Row
                  id={plan.tableId}
                  className={cn("hover:bg-muted/30", onPlanClick && "cursor-pointer")}
                  onAction={onPlanClick ? () => onPlanClick(plan) : undefined}
                >
                  <Table.Cell className={BODY_CELL_CLASS}>
                    <FundCell plan={plan} />
                  </Table.Cell>
                  <Table.Cell className={cn(BODY_CELL_CLASS, "text-compact font-medium tabular-nums")}>
                    {formatInr(plan.amount_inr)}
                  </Table.Cell>
                  <Table.Cell className={cn(BODY_CELL_CLASS, "text-compact text-muted-foreground")}>
                    {formatFrequency(plan)}
                  </Table.Cell>
                  <Table.Cell
                    className={cn(
                      BODY_CELL_CLASS,
                      "text-compact",
                      isSipNextInstallmentNoData(plan)
                        ? "font-medium uppercase tracking-wide text-muted-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatSipNextInstallmentDate(plan)}
                  </Table.Cell>
                  <Table.Cell className={BODY_CELL_CLASS}>
                    <MfSipPlanStatusBadge plan={plan} />
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>

          {loadMoreRef ? <div ref={loadMoreRef} className="h-px w-full" aria-hidden="true" /> : null}
        </div>

        {loadingMore ? (
          <div className="flex items-center justify-center border-t border-border px-4 py-3 text-caption text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            {copy.mySips.loadingMore}
          </div>
        ) : null}
        {!loadingMore && hasMore ? (
          <div className="border-t border-border px-4 py-2 text-center text-caption text-muted-foreground">
            {copy.mySips.scrollForMore}
          </div>
        ) : null}
      </TableCard.Root>
    </div>
  );
}
