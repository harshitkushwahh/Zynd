"use client";

import { memo, useCallback, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { SortDescriptor } from "react-aria-components";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ChevronSelectorVertical } from "@untitledui/icons";
import { GripVertical, Loader2, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Table, TableCard } from "@/components/core/table";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import {
  dedupeInvestFunds,
  displayCategoryLabel,
  MF_FUNDS_TABLE_DEFAULT_SORT,
  pinScreenerSelectedFundTableRows,
  sortFundTableRows,
} from "@/features/invest/lib/mf-fund-ranking";
import { formatSignedReturn, resolveAmcLogoUrl } from "@/features/invest/lib/mf-format";
import {
  beginMfFundScreenerDrag,
  endMfFundScreenerDrag,
  MF_FUND_SCREENER_DRAG_MIME,
  serializeMfFundScreenerDragPayload,
  setMfFundScreenerDragPreview,
} from "@/features/invest/lib/mf-fund-screener-drag";
import { mfFundHref } from "@/features/invest/lib/mf-fund-url";
import { screenerQueueRejectMessage } from "@/features/invest/lib/mf-screener-queue-messages";
import { useMfFundScreenerSelectionOptional } from "@/features/invest/contexts/mf-fund-screener-selection-context";
import { copy } from "@/shared/config/copy";
import { getRandomFinanceQuote } from "@/lib/finance-quotes";
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
  draggableRows?: boolean;
  screenerSelectionEnabled?: boolean;
  compact?: boolean;
  hideCategoryColumn?: boolean;
};

type FundsTableLayout = {
  tableClass: string;
  colSelect: string;
  colName: string;
  colCategory: string;
  colReturn: string;
  headerCellClass: string;
  selectHeaderCellClass: string;
  selectBodyCellClass: string;
  nameHeaderCellClass: string;
  nameBodyCellClass: string;
  returnHeaderCellClass: string;
  bodyCellClass: string;
  returnBodyCellClass: string;
  hideCategoryColumn: boolean;
  fundLogoSizeClass: string;
};

function resolveFundsTableLayout(options: {
  compact?: boolean;
  hideCategoryColumn?: boolean;
}): FundsTableLayout {
  const hideCategoryColumn = options.hideCategoryColumn ?? false;

  if (options.compact) {
    return {
      tableClass: "w-full table-fixed border-collapse border-spacing-0",
      colSelect: "w-[2rem]",
      colName: hideCategoryColumn ? "w-[58%]" : "w-[42%]",
      colCategory: hideCategoryColumn ? "w-0" : "w-[16%]",
      colReturn: "w-[14%]",
      headerCellClass: "px-2.5 py-3 text-left",
      selectHeaderCellClass: "py-3 pl-1 pr-0 text-center",
      selectBodyCellClass: "py-2.5 pl-1 pr-0 text-compact text-foreground",
      nameHeaderCellClass: "py-3 pl-2 pr-2.5 text-left",
      nameBodyCellClass: "py-2.5 pl-2 pr-2.5 text-compact text-foreground",
      returnHeaderCellClass: "px-1.5 py-3 text-right",
      bodyCellClass: "px-2.5 py-2.5 text-compact text-foreground",
      returnBodyCellClass:
        "px-1.5 py-2.5 text-caption text-foreground text-right tabular-nums whitespace-nowrap",
      hideCategoryColumn,
      fundLogoSizeClass: "size-7",
    };
  }

  return {
    tableClass: "w-full min-w-[720px] table-fixed border-collapse border-spacing-0",
    colSelect: "w-[2.25rem]",
    colName: "w-[50%]",
    colCategory: "w-[10%]",
    colReturn: "w-[5.75rem]",
    headerCellClass: "px-4 py-4 md:px-5 text-left",
    selectHeaderCellClass: "py-4 pl-1 pr-0 text-center",
    selectBodyCellClass: "py-3 pl-1 pr-0 text-compact text-foreground",
    nameHeaderCellClass: "py-4 pl-2 pr-4 text-left md:pr-5",
    nameBodyCellClass: "py-3 pl-2 pr-4 text-compact text-foreground md:pr-5",
    returnHeaderCellClass: "px-2 py-4 md:px-3 text-right",
    bodyCellClass: "px-4 py-3 md:px-5 text-compact text-foreground",
    returnBodyCellClass: "px-2 py-3 md:px-3 text-compact text-foreground text-right tabular-nums whitespace-nowrap",
    hideCategoryColumn,
    fundLogoSizeClass: "size-8",
  };
}

const HEADER_SURFACE_CLASS =
  "bg-card/95 backdrop-blur-[var(--blur-sm)] supports-[backdrop-filter]:bg-card/80";
const HEADER_ROW_CLASS =
  "sticky top-0 z-10 bg-transparent [&>th]:border-b [&>th]:border-border";
const HEADER_CELL_CLASS = "px-4 py-4 md:px-5 text-left";
const RETURN_HEADER_CELL_CLASS = "px-2 py-4 md:px-3 text-right";
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

const FundNameCell = memo(function FundNameCell({
  fund,
  logoSizeClass = "size-8",
}: {
  fund: InvestFundSummary;
  logoSizeClass?: string;
}) {
  const logoUrl = resolveAmcLogoUrl(fund.amc_logo_url, fund.amc_slug);

  return (
    <div className="flex min-w-0 items-start gap-2.5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            "mt-0.5 shrink-0 rounded-[var(--radius-control)] border border-border bg-background object-contain",
            logoSizeClass,
          )}
        />
      ) : (
        <div
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted text-[10px] font-semibold text-muted-foreground",
            logoSizeClass,
          )}
        >
          {fund.amc_name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="min-w-0 font-medium leading-snug break-words whitespace-normal text-foreground">
        {fund.name}
      </span>
    </div>
  );
});

function MfFundsTableListEnd({ className }: { className?: string }) {
  const [quote] = useState(() => getRandomFinanceQuote());

  return (
    <div className={cn(className)} aria-live="polite">
      <p className="mx-auto max-w-2xl text-compact italic leading-relaxed text-muted-foreground/85">
        {copy.mutualFunds.listEnd}
        <span aria-hidden="true"> · </span>
        <span>{quote}</span>
      </p>
    </div>
  );
}

function MfFundsTableEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
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
  const isEmpty = value == null;

  return (
    <span
      className={cn(
        isEmpty && "text-[11px] font-medium uppercase tracking-wide text-muted-foreground/40",
        !isEmpty && "tabular-nums",
        !isEmpty && formatted.tone === "positive" && "text-success",
        !isEmpty && formatted.tone === "negative" && "text-destructive",
        !isEmpty && formatted.tone === "muted" && "text-muted-foreground",
      )}
    >
      {formatted.text}
    </span>
  );
});

type FundTableDataRowProps = {
  fund: MfFundsTableRow;
  selected: boolean;
  layout: FundsTableLayout;
  draggable?: boolean;
  screenerSelectionEnabled?: boolean;
  selectionChecked?: boolean;
  onToggleSelection?: () => void;
  onNavigate: () => void;
  onDoubleClick?: () => void;
};

const FundTableDataRow = memo(function FundTableDataRow({
  fund,
  selected,
  layout,
  draggable = false,
  screenerSelectionEnabled = false,
  selectionChecked = false,
  onToggleSelection,
  onNavigate,
  onDoubleClick,
}: FundTableDataRowProps) {
  const dragStartedRef = useRef(false);

  function handleDragStart(event: React.DragEvent<HTMLTableCellElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]')) {
      event.preventDefault();
      return;
    }

    dragStartedRef.current = true;
    beginMfFundScreenerDrag(serializeMfFundScreenerDragPayload(fund));
    event.dataTransfer.effectAllowed = "copy";
    const payload = JSON.stringify(serializeMfFundScreenerDragPayload(fund));
    event.dataTransfer.setData(MF_FUND_SCREENER_DRAG_MIME, payload);
    event.dataTransfer.setData("application/json", payload);
    setMfFundScreenerDragPreview(event, fund);
  }

  function handleDragEnd() {
    endMfFundScreenerDrag();
    window.setTimeout(() => {
      dragStartedRef.current = false;
    }, 0);
  }

  function handleClick(event: React.MouseEvent<HTMLTableRowElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]')) return;
    if (dragStartedRef.current) {
      dragStartedRef.current = false;
      return;
    }
    onNavigate();
  }

  const dragProps = draggable
    ? {
        draggable: true as const,
        onDragStart: handleDragStart,
        onDragEnd: handleDragEnd,
      }
    : {};

  return (
    <tr
      className={cn(
        "group/row cursor-pointer transition-colors hover:bg-muted/20",
        draggable && "[&_td]:cursor-grab [&_td]:active:cursor-grabbing",
        (selected || selectionChecked) && "bg-muted/50",
      )}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
    >
      {screenerSelectionEnabled ? (
        <td
          {...dragProps}
          className={cn(
            "min-h-14 border-b border-border/70 align-middle",
            layout.colSelect,
            layout.selectBodyCellClass,
          )}
        >
          <div className="flex items-center justify-start gap-0">
            <span
              className={cn(
                "pointer-events-none flex size-5 shrink-0 items-center justify-center text-muted-foreground/70",
                "opacity-0 transition-opacity group-hover/row:opacity-100",
              )}
              aria-hidden
            >
              <GripVertical className="size-3" strokeWidth={2.25} />
            </span>
            <input
              type="checkbox"
              checked={selectionChecked}
              aria-label={`Select ${fund.name}`}
              onChange={() => onToggleSelection?.()}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              draggable={false}
              className="size-3 shrink-0 rounded border-input accent-primary"
            />
          </div>
        </td>
      ) : null}
      <td
        {...dragProps}
        className={cn(
          "min-h-14 border-b border-border/70 align-top",
          layout.colName,
          screenerSelectionEnabled ? layout.nameBodyCellClass : layout.bodyCellClass,
        )}
      >
        <FundNameCell fund={fund} logoSizeClass={layout.fundLogoSizeClass} />
      </td>
      {!layout.hideCategoryColumn ? (
        <td
          {...dragProps}
          className={cn(
            "min-h-14 border-b border-border/70 align-top truncate text-caption text-muted-foreground",
            layout.colCategory,
            layout.bodyCellClass,
          )}
          title={displayCategoryLabel(fund)}
        >
          {displayCategoryLabel(fund)}
        </td>
      ) : null}
      <td
        {...dragProps}
        className={cn("min-h-14 border-b border-border/70 align-top", layout.colReturn, layout.returnBodyCellClass)}
      >
        <ReturnCell value={fund.returns.return_1y} />
      </td>
      <td
        {...dragProps}
        className={cn("min-h-14 border-b border-border/70 align-top", layout.colReturn, layout.returnBodyCellClass)}
      >
        <ReturnCell value={fund.returns.return_3y} />
      </td>
      <td
        {...dragProps}
        className={cn("min-h-14 border-b border-border/70 align-top", layout.colReturn, layout.returnBodyCellClass)}
      >
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
  align = "left",
  cellClassName,
}: {
  id: SortDescriptor["column"];
  label?: string;
  sortDescriptor: SortDescriptor;
  onSortChange: (sort: SortDescriptor) => void;
  className?: string;
  children?: ReactNode;
  align?: "left" | "right";
  cellClassName?: string;
}) {
  const sorted = sortDescriptor.column === id;
  const direction = sorted ? sortDescriptor.direction : undefined;

  return (
    <th
      scope="col"
      className={cn(
        cellClassName ??
          (align === "right" ? RETURN_HEADER_CELL_CLASS : HEADER_CELL_CLASS),
        HEADER_SURFACE_CLASS,
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSortChange(cycleSortDescriptor(sortDescriptor, id))}
        className={cn(
          "inline-flex w-full items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          align === "right" ? "justify-end text-right" : "text-left",
        )}
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
  draggableRows = false,
  screenerSelectionEnabled = false,
  compact = false,
  hideCategoryColumn = false,
}: MfFundsTableProps) {
  const router = useRouter();
  const screenerSelection = useMfFundScreenerSelectionOptional();
  const [internalSort, setInternalSort] = useState<SortDescriptor>(MF_FUNDS_TABLE_DEFAULT_SORT);
  const sortDescriptor = sortDescriptorProp ?? internalSort;
  const handleSortChange = onSortChange ?? setInternalSort;
  const layout = useMemo(
    () => resolveFundsTableLayout({ compact, hideCategoryColumn }),
    [compact, hideCategoryColumn],
  );

  const rows = useMemo<MfFundsTableRow[]>(
    () => dedupeInvestFunds(funds).map((fund) => ({ ...fund, tableId: fund.product_id })),
    [funds],
  );

  const showScreenerSelection = screenerSelectionEnabled && screenerSelection != null;
  const columnCount =
    (showScreenerSelection ? 1 : 0) + (layout.hideCategoryColumn ? 4 : 5);
  const selectedProductIds = useMemo(
    () => screenerSelection?.selectedFunds.map((fund) => fund.product_id) ?? [],
    [screenerSelection?.selectedFunds],
  );

  const sortedRows = useMemo(() => {
    const sorted = serverSorted ? rows : sortFundTableRows(rows, sortDescriptor);
    if (!showScreenerSelection || selectedProductIds.length === 0) return sorted;
    return pinScreenerSelectedFundTableRows(sorted, selectedProductIds);
  }, [rows, selectedProductIds, serverSorted, showScreenerSelection, sortDescriptor]);

  const handleToggleScreenerSelection = useCallback(
    (fund: MfFundsTableRow) => {
      if (!screenerSelection) return;
      const wasSelected = screenerSelection.isSelected(fund.product_id);
      const result = screenerSelection.toggleFund(fund);
      if (result === "full" && !wasSelected) {
        toast.error(
          screenerQueueRejectMessage(
            screenerSelection.selectionCount,
            screenerSelection.maxSelectableFunds,
          ),
        );
      }
    },
    [screenerSelection],
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
        <MfFundsTableListEnd
          className={cn(
            layout.tableClass,
            "border-t border-border px-4 py-6 text-center sm:px-5",
          )}
        />
      ) : null}

      {loadingMore ? <LoadingMoreIndicator /> : null}
    </>
  );

  const emptyState = (
    <MfFundsTableEmptyState
      title={emptyTitle ?? copy.mutualFunds.allFundsEmpty}
      description={emptyDescription ?? copy.mutualFunds.allFundsEmptyDescription}
    />
  );

  if (sortedRows.length === 0) {
    return (
      <div className={cn("flex flex-col", className)}>
        <TableCard.Root
          size="sm"
          className="rounded-none border-0 shadow-none"
        >
          {emptyState}
        </TableCard.Root>
      </div>
    );
  }

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
              "h-full min-h-0 overflow-auto overscroll-y-contain",
              compact ? "overflow-x-hidden" : "overscroll-x-auto",
              refetching && "opacity-60",
            )}
          >
            {virtualized ? (
              <>
                <table className={layout.tableClass} aria-label={copy.mutualFunds.allFundsTitle}>
                  <colgroup>
                    {showScreenerSelection ? <col className={layout.colSelect} /> : null}
                    <col className={layout.colName} />
                    {!layout.hideCategoryColumn ? <col className={layout.colCategory} /> : null}
                    <col className={layout.colReturn} />
                    <col className={layout.colReturn} />
                    <col className={layout.colReturn} />
                  </colgroup>
                  <thead className={HEADER_ROW_CLASS}>
                    <tr>
                      {showScreenerSelection ? (
                        <th
                          scope="col"
                          className={cn(
                            layout.selectHeaderCellClass,
                            HEADER_SURFACE_CLASS,
                            layout.colSelect,
                          )}
                          aria-label={copy.mutualFunds.screenerSelectColumnLabel}
                        />
                      ) : null}
                      <VirtualSortHead
                        id="name"
                        sortDescriptor={sortDescriptor}
                        onSortChange={handleSortChange}
                        className={layout.colName}
                        cellClassName={
                          showScreenerSelection ? layout.nameHeaderCellClass : layout.headerCellClass
                        }
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
                      {!layout.hideCategoryColumn ? (
                        <VirtualSortHead
                          id="category"
                          label={copy.mutualFunds.tableCategory}
                          sortDescriptor={sortDescriptor}
                          onSortChange={handleSortChange}
                          className={layout.colCategory}
                          cellClassName={layout.headerCellClass}
                        />
                      ) : null}
                      <VirtualSortHead
                        id="return_1y"
                        label={copy.mutualFunds.tableReturn1y}
                        sortDescriptor={sortDescriptor}
                        onSortChange={handleSortChange}
                        className={layout.colReturn}
                        cellClassName={layout.returnHeaderCellClass}
                        align="right"
                      />
                      <VirtualSortHead
                        id="return_3y"
                        label={copy.mutualFunds.tableReturn3y}
                        sortDescriptor={sortDescriptor}
                        onSortChange={handleSortChange}
                        className={layout.colReturn}
                        cellClassName={layout.returnHeaderCellClass}
                        align="right"
                      />
                      <VirtualSortHead
                        id="return_5y"
                        label={copy.mutualFunds.tableReturn5y}
                        sortDescriptor={sortDescriptor}
                        onSortChange={handleSortChange}
                        className={layout.colReturn}
                        cellClassName={layout.returnHeaderCellClass}
                        align="right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {paddingTop > 0 ? (
                      <tr aria-hidden="true">
                        <td colSpan={columnCount} style={{ height: paddingTop, padding: 0, border: 0 }} />
                      </tr>
                    ) : null}
                    {virtualItems.map((virtualRow) => {
                      const fund = sortedRows[virtualRow.index];
                      if (!fund) return null;

                      return (
                        <FundTableDataRow
                          key={fund.tableId}
                          fund={fund}
                          layout={layout}
                          selected={selectedProductId === fund.product_id}
                          draggable={draggableRows}
                          screenerSelectionEnabled={showScreenerSelection}
                          selectionChecked={
                            showScreenerSelection
                              ? screenerSelection.isSelected(fund.product_id)
                              : false
                          }
                          onToggleSelection={
                            showScreenerSelection
                              ? () => handleToggleScreenerSelection(fund)
                              : undefined
                          }
                          onNavigate={() => navigateToFund(fund)}
                          onDoubleClick={
                            onRowDoubleClick ? () => onRowDoubleClick(fund) : undefined
                          }
                        />
                      );
                    })}
                    {paddingBottom > 0 ? (
                      <tr aria-hidden="true">
                        <td colSpan={columnCount} style={{ height: paddingBottom, padding: 0, border: 0 }} />
                      </tr>
                    ) : null}
                  </tbody>
                </table>

                {tableFooter}
              </>
            ) : (
              <>
                <Table
                  aria-label={copy.mutualFunds.allFundsTitle}
                  size="sm"
                  className={layout.tableClass}
                  sortDescriptor={sortDescriptor}
                  onSortChange={handleSortChange}
                >
                  <Table.Header bordered={false} className="sticky top-0 z-10 !h-auto !bg-transparent [&>tr>th]:after:!hidden [&>tr]:border-b [&>tr]:border-border">
                    <Table.Head
                      id="name"
                      isRowHeader
                      allowsSorting
                      className={cn(
                        layout.colName,
                        showScreenerSelection ? layout.nameHeaderCellClass : layout.headerCellClass,
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
                    {!layout.hideCategoryColumn ? (
                      <Table.Head
                        id="category"
                        label={copy.mutualFunds.tableCategory}
                        allowsSorting
                        className={cn(
                          layout.colCategory,
                          layout.headerCellClass,
                          " [&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground",
                          HEADER_SURFACE_CLASS,
                        )}
                      />
                    ) : null}
                    <Table.Head
                      id="return_1y"
                      label={copy.mutualFunds.tableReturn1y}
                      allowsSorting
                      className={cn(
                        layout.colReturn,
                        layout.returnHeaderCellClass,
                        " [&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground",
                        HEADER_SURFACE_CLASS,
                        "[&>div]:w-full [&>div]:justify-end",
                      )}
                    />
                    <Table.Head
                      id="return_3y"
                      label={copy.mutualFunds.tableReturn3y}
                      allowsSorting
                      className={cn(
                        layout.colReturn,
                        layout.returnHeaderCellClass,
                        " [&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground",
                        HEADER_SURFACE_CLASS,
                        "[&>div]:w-full [&>div]:justify-end",
                      )}
                    />
                    <Table.Head
                      id="return_5y"
                      label={copy.mutualFunds.tableReturn5y}
                      allowsSorting
                      className={cn(
                        layout.colReturn,
                        layout.returnHeaderCellClass,
                        " [&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground",
                        HEADER_SURFACE_CLASS,
                        "[&>div]:w-full [&>div]:justify-end",
                      )}
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
                          <Table.Cell className={cn("align-top", layout.colName, layout.bodyCellClass)}>
                            <FundNameCell fund={fund} logoSizeClass={layout.fundLogoSizeClass} />
                          </Table.Cell>
                          {!layout.hideCategoryColumn ? (
                            <Table.Cell
                              className={cn(
                                "align-top truncate text-caption text-muted-foreground",
                                layout.colCategory,
                                layout.bodyCellClass,
                              )}
                              title={displayCategoryLabel(fund)}
                            >
                              {displayCategoryLabel(fund)}
                            </Table.Cell>
                          ) : null}
                          <Table.Cell className={cn("align-top", layout.colReturn, layout.returnBodyCellClass)}>
                            <ReturnCell value={fund.returns.return_1y} />
                          </Table.Cell>
                          <Table.Cell className={cn("align-top", layout.colReturn, layout.returnBodyCellClass)}>
                            <ReturnCell value={fund.returns.return_3y} />
                          </Table.Cell>
                          <Table.Cell className={cn("align-top", layout.colReturn, layout.returnBodyCellClass)}>
                            <ReturnCell value={fund.returns.return_5y} />
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  ) : null}
                </Table>

                {tableFooter}
              </>
            )}
          </div>
        </div>
      </TableCard.Root>
    </div>
  );
}
