"use client";

import { useMemo, useState, type RefObject } from "react";
import type { SortDescriptor } from "react-aria-components";
import { Loader2 } from "lucide-react";

import { Table, TableCard } from "@/components/core/table";
import type { MfOrder } from "@/features/invest/api/invest-api";
import { MfOrderStatusBadge } from "@/features/invest/components/mf-order-status-badge";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { formatDate, formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfTransactionsTableRow = MfOrder & {
  tableId: string;
};

type MfTransactionsTableProps = {
  orders: MfOrder[];
  totalCount: number;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  ariaLabel: string;
  className?: string;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  loadMoreRef?: RefObject<HTMLDivElement | null>;
  onOrderClick?: (order: MfOrder) => void;
};

const TABLE_LAYOUT_CLASS = "w-full min-w-[720px] table-fixed border-collapse border-spacing-0";
const COL_FUND = "w-[38%]";
const COL_TYPE = "w-[14%]";
const COL_AMOUNT = "w-[16%] text-right [&>div]:w-full [&>div]:justify-end";
const COL_DATE = "w-[16%]";
const COL_STATUS = "w-[16%]";
const HEADER_SURFACE_CLASS =
  "bg-card/95 backdrop-blur-[var(--blur-sm)] supports-[backdrop-filter]:bg-card/80";
const HEADER_ROW_CLASS =
  "sticky top-0 z-10 !h-auto !bg-transparent [&>tr>th]:after:!hidden [&>tr]:border-b [&>tr]:border-border";
const HEADER_CELL_CLASS = "px-4 py-4 md:px-5";
const BODY_CELL_CLASS = "px-4 md:px-5";
const HEADER_LABEL_CLASS =
  "[&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground";

function formatOrderType(orderType: string) {
  const normalized = orderType.trim().toUpperCase();
  if (normalized === "LUMPSUM") return copy.transactions.typeLumpsum;
  if (normalized === "SIP") return copy.transactions.typeSip;
  if (normalized === "REDEMPTION") return copy.transactions.typeRedemption;
  return orderType.replaceAll("_", " ");
}

function FundCell({ order }: { order: MfOrder }) {
  const amcName = order.amc_name ?? copy.mutualFunds.unknownAmc;

  return (
    <div className="flex min-w-0 items-start gap-3">
      <MfFundAmcAvatar
        amcLogoUrl={order.amc_logo_url}
        amcName={amcName}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <p className="font-medium leading-snug break-words whitespace-normal text-foreground">
          {order.product_name ?? copy.mutualFunds.unknownFund}
        </p>
        <p className="mt-0.5 truncate text-caption text-muted-foreground">{amcName}</p>
      </div>
    </div>
  );
}

export function MfTransactionsTable({
  orders,
  totalCount,
  loading = false,
  loadingMore = false,
  hasMore = false,
  ariaLabel,
  className,
  scrollContainerRef,
  loadMoreRef,
  onOrderClick,
}: MfTransactionsTableProps) {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "date",
    direction: "descending",
  });

  const rows = useMemo<MfTransactionsTableRow[]>(
    () => orders.map((order) => ({ ...order, tableId: order.order_id })),
    [orders],
  );

  const sortedRows = useMemo(() => {
    const column = sortDescriptor.column;
    const direction = sortDescriptor.direction === "descending" ? -1 : 1;

    return [...rows].sort((a, b) => {
      if (column === "fund") {
        return (a.product_name ?? "").localeCompare(b.product_name ?? "") * direction;
      }
      if (column === "type") {
        return a.order_type.localeCompare(b.order_type) * direction;
      }
      if (column === "amount") {
        return (a.amount_inr - b.amount_inr) * direction;
      }
      if (column === "date") {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return (aTime - bTime) * direction;
      }
      if (column === "status") {
        return a.status.localeCompare(b.status) * direction;
      }
      return 0;
    });
  }, [rows, sortDescriptor]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        {copy.transactions.loading}
      </div>
    );
  }

  if (sortedRows.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center px-6 text-center">
        <p className="text-compact text-muted-foreground">{copy.transactions.emptyFiltered}</p>
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
                  {copy.transactions.tableFund}
                </span>
                <span className="text-caption font-medium text-muted-foreground tabular-nums">
                  ({totalCount} results)
                </span>
              </Table.Head>
              <Table.Head
                id="type"
                label={copy.transactions.tableType}
                allowsSorting
                className={cn(COL_TYPE, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
              <Table.Head
                id="amount"
                label={copy.transactions.tableAmount}
                allowsSorting
                className={cn(COL_AMOUNT, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
              <Table.Head
                id="date"
                label={copy.transactions.tableDate}
                allowsSorting
                className={cn(COL_DATE, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
              <Table.Head
                id="status"
                label={copy.transactions.tableStatus}
                allowsSorting
                className={cn(COL_STATUS, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
            </Table.Header>

            <Table.Body className="[&>tr:first-child>td]:border-t-0" items={sortedRows}>
              {(order) => (
                <Table.Row
                  id={order.tableId}
                  className={cn("hover:bg-muted/30", onOrderClick && "cursor-pointer")}
                  onAction={onOrderClick ? () => onOrderClick(order) : undefined}
                >
                  <Table.Cell className={BODY_CELL_CLASS}>
                    <FundCell order={order} />
                  </Table.Cell>
                  <Table.Cell className={cn(BODY_CELL_CLASS, "text-compact text-muted-foreground")}>
                    {formatOrderType(order.order_type)}
                  </Table.Cell>
                  <Table.Cell className={cn(BODY_CELL_CLASS, "text-right text-compact font-medium tabular-nums")}>
                    {formatInr(order.amount_inr)}
                  </Table.Cell>
                  <Table.Cell className={cn(BODY_CELL_CLASS, "text-compact text-muted-foreground")}>
                    {formatDate(order.created_at)}
                  </Table.Cell>
                  <Table.Cell className={BODY_CELL_CLASS}>
                    <MfOrderStatusBadge status={order.status} />
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
            {copy.transactions.loadingMore}
          </div>
        ) : null}
        {!loadingMore && hasMore ? (
          <div className="border-t border-border px-4 py-2 text-center text-caption text-muted-foreground">
            {copy.transactions.scrollForMore}
          </div>
        ) : null}
      </TableCard.Root>
    </div>
  );
}
