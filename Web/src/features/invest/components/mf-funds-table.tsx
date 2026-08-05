"use client";

import { memo, useCallback, useMemo, useState, type ReactNode, type RefObject } from "react";
import type { SortDescriptor } from "react-aria-components";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ChevronSelectorVertical } from "@untitledui/icons";
import { Loader2, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";

import { Table, TableCard } from "@/components/core/table";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import {
  dedupeInvestFunds,
  displayCategoryLabel,
  MF_FUNDS_TABLE_DEFAULT_SORT,
  sortFundTableRows,
} from "@/features/invest/lib/mf-fund-ranking";
import { formatSignedReturn, resolveAmcLogoUrl } from "@/features/invest/lib/mf-format";
import { mfFundHref } from "@/features/invest/lib/mf-fund-url";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFundsTableRow = InvestFundSummary & {
  tableId: string;
};

type MfFundsTableProps = {
  funds: InvestFundSummary[];
  totalCount: number;
  refetching?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  className?: string;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  loadMoreRef?: RefObject<HTMLDivElement | null>;
  onRowClick?: (fund: InvestFundSummary) => void;
  onRowDoubleClick?: (fund: InvestFundSummary) => void;
  selectedProductId?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  virtualized?: boolean;
  sortDescriptor?: SortDescriptor;
  onSortChange?: (sort: SortDescriptor) => void;
  serverSorted?: boolean;
};

const TABLE_LAYOUT_CLASS = "w-full min-w-[680px] table-fixed border-collapse border-spacing-0";
const COL_NAME = "w-[44%]";
const COL_CATEGORY = "w-[14%]";
const COL_RETURN = "w-[14%] text-right";
const HEADER_SURFACE_CLASS = "bg-card/95 supports-[backdrop-filter]:bg-card/80";
const HEADER_ROW_CLASS = "sticky top-0 z-10 bg-muted/25 [&>th]:border-b [&>th]:border-border";
const HEADER_CELL_CLASS = "px-4 py-4 md:px-5 text-left";
const BODY_CELL_CLASS = "px-4 py-3 md:px-5 text-compact text-foreground";
const VIRTUAL_ROW_HEIGHT = 60;
const VIRTUAL_OVERSCAN = 12;

function cycleSortDescriptor(
  current: SortDescriptor,
  column: SortDescriptor["column"],
): SortDescriptor {
  if (current.column !== column) {
    return { column, direction: "ascending" };
  }
  if (current.direction === "ascending") {
    return { column, direction: "descending" };
  }
  return { column, direction: "ascending" };
}

const FundNameCell = memo(function FundNameCell({ fund }: { fund: InvestFundSummary }) {
  const logoUrl = resolveAmcLogoUrl(fund.amc_logo_url, fund.amc_slug);

  return (
    <div className="flex min-w-0 items-start gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="mt-0.5 size-8 shrink-0 rounded-[var(--radius-control)] border border-border bg-background object-contain"
        />
      ) : (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
          {fund.amc_name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="font-medium leading-snug break-words whitespace-normal text-foreground">
        {fund.name}
      </span>
    </div>
  );
});

function MfFundsTableEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <SearchX className="size-10 text-[var(--sip-empty-icon)]" strokeWidth={1.75} aria-hidden />
      <div>
        <p className="text-compact font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 max-w-sm text-caption text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

const ReturnCell = memo(function ReturnCell({ value }: { value: number | null | undefined }) {
  const formatted = formatSignedReturn(value);
  return (
    <span
      className={cn(
        "tabular-nums",
        formatted.tone === "positive" && "text-success",
        formatted.tone === "negative" && "text-destructive",
        formatted.tone === "muted" && "text-muted-foreground",
      )}
    >
      {formatted.text}
    </span>
  );
});

type FundTableDataRowProps = {
  fund: MfFundsTableRow;
  selected: boolean;
  onNavigate: () => void;
  onDoubleClick?: () => void;
};

const FundTableDataRow = memo(function FundTableDataRow({
  fund,
  selected,
  onNavigate,
  onDoubleClick,
}: FundTableDataRowProps) {
  return (
    <tr
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/20",
        selected && "bg-muted/50",
      )}
      onClick={onNavigate}
      onDoubleClick={onDoubleClick}
    >
      <td className={cn("min-h-14 border-b border-border/70 align-top", COL_NAME, BODY_CELL_CLASS)}>
        <FundNameCell fund={fund} />
      </td>
      <td
        className={cn(
          "min-h-14 border-b border-border/70 align-top truncate text-caption text-muted-foreground",
          COL_CATEGORY,
          BODY_CELL_CLASS,
        )}
        title={displayCategoryLabel(fund)}
      >
        {displayCategoryLabel(fund)}
      </td>
      <td className={cn("min-h-14 border-b border-border/70 align-top text-right", COL_RETURN, BODY_CELL_CLASS)}>
        <ReturnCell value={fund.returns.return_1y} />
      </td>
      <td className={cn("min-h-14 border-b border-border/70 align-top text-right", COL_RETURN, BODY_CELL_CLASS)}>
        <ReturnCell value={fund.returns.return_3y} />
      </td>
      <td className={cn("min-h-14 border-b border-border/70 align-top text-right", COL_RETURN, BODY_CELL_CLASS)}>
        <ReturnCell value={fund.returns.return_5y} />
      </td>
    </tr>
  );
});

function VirtualSortHead({
  id,
  label,
  sortDescriptor,
  onSortChange,
  className,
  children,
}: {
  id: SortDescriptor["column"];
  label?: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (sort: SortDescriptor) => void;
  className?: string;
  children?: ReactNode;
}) {
  const sorted = sortDescriptor.column === id;
  const direction = sorted ? sortDescriptor.direction : undefined;

  return (
    <th scope="col" className={cn(HEADER_CELL_CLASS, HEADER_SURFACE_CLASS, className)}>
      <button
        type="button"
        onClick={() => onSortChange(cycleSortDescriptor(sortDescriptor, id))}
        className="inline-flex w-full items-center gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {children ?? (
          <span className="text-caption font-semibold tracking-wide text-foreground">{label}</span>
        )}
        {sorted && direction ? (
          <ArrowDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground",
              direction === "ascending" && "rotate-180",
            )}
          />
        ) : (
          <ChevronSelectorVertical className="size-3.5 shrink-0 text-muted-foreground/60" />
        )}
      </button>
    </th>
  );
}

function LoadingMoreIndicator() {
  return (
    <div className="sticky bottom-3 z-20 flex justify-center px-4 py-2" aria-live="polite" aria-busy>
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-caption text-muted-foreground shadow-zynd-low">
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
        {copy.mutualFunds.loadingMore}
      </span>
    </div>
  );
}

export function MfFundsTable({
  funds,
  totalCount,
  refetching = false,
  loadingMore = false,
  hasMore = false,
  className,
  scrollContainerRef,
  loadMoreRef,
  onRowClick,
  onRowDoubleClick,
  selectedProductId,
  emptyTitle,
  emptyDescription,
  virtualized = false,
  sortDescriptor: sortDescriptorProp,
  onSortChange,
  serverSorted = false,
}: MfFundsTableProps) {
  const router = useRouter();
  const [internalSort, setInternalSort] = useState<SortDescriptor>(MF_FUNDS_TABLE_DEFAULT_SORT);
  const sortDescriptor = sortDescriptorProp ?? internalSort;
  const handleSortChange = onSortChange ?? setInternalSort;

  const rows = useMemo<MfFundsTableRow[]>(
    () => dedupeInvestFunds(funds).map((fund) => ({ ...fund, tableId: fund.product_id })),
    [funds],
  );

  const sortedRows = useMemo(
    () => (serverSorted ? rows : sortFundTableRows(rows, sortDescriptor)),
    [rows, serverSorted, sortDescriptor],
  );

  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

  const scrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      setScrollElement(node);
      if (scrollContainerRef) {
        scrollContainerRef.current = node;
      }
    },
    [scrollContainerRef],
  );

  const rowVirtualizer = useVirtualizer({
    count: virtualized ? sortedRows.length : 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => VIRTUAL_ROW_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
  });

  const virtualItems = virtualized ? rowVirtualizer.getVirtualItems() : [];
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  const navigateToFund = useCallback(
    (fund: InvestFundSummary) => {
      if (onRowClick) {
        onRowClick(fund);
        return;
      }
      router.push(mfFundHref(fund));
    },
    [onRowClick, router],
  );

  const tableFooter = (
    <>
      {sortedRows.length > 0 && hasMore && loadMoreRef ? (
        <div ref={loadMoreRef} className="h-px w-full shrink-0" aria-hidden="true" />
      ) : null}

      {!loadingMore && sortedRows.length > 0 && !hasMore ? (
        <div
          className={cn(
            TABLE_LAYOUT_CLASS,
            "border-t border-border py-4 text-center text-caption text-muted-foreground",
          )}
          aria-live="polite"
        >
          {copy.mutualFunds.listEnd}
        </div>
      ) : null}

      {loadingMore ? <LoadingMoreIndicator /> : null}
    </>
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <TableCard.Root
        size="sm"
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 shadow-none"
      >
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            className={cn(
              "h-full min-h-0 overflow-auto overscroll-y-contain overscroll-x-auto",
              refetching && "opacity-60",
            )}
          >
            {virtualized ? (
              <>
                <table className={TABLE_LAYOUT_CLASS} aria-label={copy.mutualFunds.allFundsTitle}>
                  <thead className={HEADER_ROW_CLASS}>
                    <tr>
                      <VirtualSortHead
                        id="name"
                        sortDescriptor={sortDescriptor}
                        onSortChange={handleSortChange}
                        className={COL_NAME}
                      >
                        <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                          <span className="text-compact font-semibold tracking-tight text-foreground">
                            Fund Name
                          </span>
                          <span className="text-caption font-medium text-muted-foreground tabular-nums">
                            ({totalCount} results)
                          </span>
                        </span>
                      </VirtualSortHead>
                      <VirtualSortHead
                        id="category"
                        label={copy.mutualFunds.tableCategory}
                        sortDescriptor={sortDescriptor}
                        onSortChange={handleSortChange}
                        className={COL_CATEGORY}
                      />
                      <VirtualSortHead
                        id="return_1y"
                        label={copy.mutualFunds.tableReturn1y}
                        sortDescriptor={sortDescriptor}
                        onSortChange={handleSortChange}
                        className={COL_RETURN}
                      />
                      <VirtualSortHead
                        id="return_3y"
                        label={copy.mutualFunds.tableReturn3y}
                        sortDescriptor={sortDescriptor}
                        onSortChange={handleSortChange}
                        className={COL_RETURN}
                      />
                      <VirtualSortHead
                        id="return_5y"
                        label={copy.mutualFunds.tableReturn5y}
                        sortDescriptor={sortDescriptor}
                        onSortChange={handleSortChange}
                        className={COL_RETURN}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {paddingTop > 0 ? (
                      <tr aria-hidden="true">
                        <td colSpan={5} style={{ height: paddingTop, padding: 0, border: 0 }} />
                      </tr>
                    ) : null}
                    {virtualItems.map((virtualRow) => {
                      const fund = sortedRows[virtualRow.index];
                      if (!fund) return null;

                      return (
                        <FundTableDataRow
                          key={fund.tableId}
                          fund={fund}
                          selected={selectedProductId === fund.product_id}
                          onNavigate={() => navigateToFund(fund)}
                          onDoubleClick={
                            onRowDoubleClick ? () => onRowDoubleClick(fund) : undefined
                          }
                        />
                      );
                    })}
                    {paddingBottom > 0 ? (
                      <tr aria-hidden="true">
                        <td colSpan={5} style={{ height: paddingBottom, padding: 0, border: 0 }} />
                      </tr>
                    ) : null}
                  </tbody>
                </table>

                {sortedRows.length === 0 ? (
                  <MfFundsTableEmptyState
                    title={emptyTitle ?? copy.mutualFunds.allFundsEmpty}
                    description={emptyDescription ?? copy.mutualFunds.allFundsEmptyDescription}
                  />
                ) : null}

                {tableFooter}
              </>
            ) : (
              <>
                <Table
                  aria-label={copy.mutualFunds.allFundsTitle}
                  size="sm"
                  className={TABLE_LAYOUT_CLASS}
                  sortDescriptor={sortDescriptor}
                  onSortChange={handleSortChange}
                >
                  <Table.Header bordered={false} className="sticky top-0 z-10 !h-auto !bg-transparent [&>tr>th]:after:!hidden [&>tr]:border-b [&>tr]:border-border">
                    <Table.Head
                      id="name"
                      isRowHeader
                      allowsSorting
                      className={cn(
                        COL_NAME,
                        HEADER_CELL_CLASS,
                        HEADER_SURFACE_CLASS,
                        "[&>div>span]:inline-flex [&>div>span]:flex-wrap [&>div>span]:items-baseline [&>div>span]:gap-x-1.5",
                      )}
                    >
                      <span className="text-compact font-semibold tracking-tight text-foreground">
                        Fund Name
                      </span>
                      <span className="text-caption font-medium text-muted-foreground tabular-nums">
                        ({totalCount} results)
                      </span>
                    </Table.Head>
                    <Table.Head
                      id="category"
                      label={copy.mutualFunds.tableCategory}
                      allowsSorting
                      className={cn(COL_CATEGORY, HEADER_CELL_CLASS, " [&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground", HEADER_SURFACE_CLASS)}
                    />
                    <Table.Head
                      id="return_1y"
                      label={copy.mutualFunds.tableReturn1y}
                      allowsSorting
                      className={cn(COL_RETURN, HEADER_CELL_CLASS, " [&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground", HEADER_SURFACE_CLASS, "[&>div]:w-full [&>div]:justify-end")}
                    />
                    <Table.Head
                      id="return_3y"
                      label={copy.mutualFunds.tableReturn3y}
                      allowsSorting
                      className={cn(COL_RETURN, HEADER_CELL_CLASS, " [&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground", HEADER_SURFACE_CLASS, "[&>div]:w-full [&>div]:justify-end")}
                    />
                    <Table.Head
                      id="return_5y"
                      label={copy.mutualFunds.tableReturn5y}
                      allowsSorting
                      className={cn(COL_RETURN, HEADER_CELL_CLASS, " [&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground", HEADER_SURFACE_CLASS, "[&>div]:w-full [&>div]:justify-end")}
                    />
                  </Table.Header>

                  {sortedRows.length > 0 ? (
                    <Table.Body className="[&>tr:first-child>td]:border-t-0" items={sortedRows}>
                      {(fund) => (
                        <Table.Row
                          id={fund.tableId}
                          className={cn(
                            "cursor-pointer",
                            selectedProductId === fund.product_id && "bg-muted/50",
                          )}
                          onAction={() => navigateToFund(fund)}
                          onDoubleClick={() => {
                            if (onRowDoubleClick) {
                              onRowDoubleClick(fund);
                            }
                          }}
                        >
                          <Table.Cell className={cn("align-top", COL_NAME, BODY_CELL_CLASS)}>
                            <FundNameCell fund={fund} />
                          </Table.Cell>
                          <Table.Cell
                            className={cn(
                              "align-top truncate text-caption text-muted-foreground",
                              COL_CATEGORY,
                              BODY_CELL_CLASS,
                            )}
                            title={displayCategoryLabel(fund)}
                          >
                            {displayCategoryLabel(fund)}
                          </Table.Cell>
                          <Table.Cell className={cn("align-top text-right", COL_RETURN, BODY_CELL_CLASS)}>
                            <ReturnCell value={fund.returns.return_1y} />
                          </Table.Cell>
                          <Table.Cell className={cn("align-top text-right", COL_RETURN, BODY_CELL_CLASS)}>
                            <ReturnCell value={fund.returns.return_3y} />
                          </Table.Cell>
                          <Table.Cell className={cn("align-top text-right", COL_RETURN, BODY_CELL_CLASS)}>
                            <ReturnCell value={fund.returns.return_5y} />
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  ) : null}
                </Table>

                {sortedRows.length === 0 ? (
                  <MfFundsTableEmptyState
                    title={emptyTitle ?? copy.mutualFunds.allFundsEmpty}
                    description={emptyDescription ?? copy.mutualFunds.allFundsEmptyDescription}
                  />
                ) : null}

                {tableFooter}
              </>
            )}
          </div>
        </div>
      </TableCard.Root>
    </div>
  );
}
