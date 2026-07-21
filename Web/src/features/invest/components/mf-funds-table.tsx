"use client";

import { useMemo, useState, type RefObject } from "react";
import type { SortDescriptor } from "react-aria-components";
import { Loader2, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";

import { Table, TableCard } from "@/components/core/table";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import { dedupeInvestFunds, displayCategoryLabel } from "@/features/invest/lib/mf-fund-ranking";
import { formatSignedReturn, resolveInvestAssetUrl } from "@/features/invest/lib/mf-format";
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
};

const TABLE_LAYOUT_CLASS = "w-full min-w-[680px] table-fixed border-collapse border-spacing-0";
const COL_NAME = "w-[44%]";
const COL_CATEGORY = "w-[14%]";
const COL_RETURN = "w-[14%] text-right [&>div]:w-full [&>div]:justify-end";
const HEADER_SURFACE_CLASS =
  "bg-card/95 backdrop-blur-[var(--blur-sm)] supports-[backdrop-filter]:bg-card/80";
const HEADER_ROW_CLASS =
  "sticky top-0 z-10 !h-auto !bg-transparent [&>tr>th]:after:!hidden [&>tr]:border-b [&>tr]:border-border";
const HEADER_CELL_CLASS = "px-4 py-4 md:px-5";
const BODY_CELL_CLASS = "px-4 md:px-5";
const HEADER_LABEL_CLASS =
  "[&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-foreground";

function FundNameCell({ fund }: { fund: InvestFundSummary }) {
  const logoUrl = resolveInvestAssetUrl(fund.amc_logo_url);

  return (
    <div className="flex min-w-0 items-start gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
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
}

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

function ReturnCell({ value }: { value: number | null | undefined }) {
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
}: MfFundsTableProps) {
  const router = useRouter();
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "return_3y",
    direction: "descending",
  });

  const rows = useMemo<MfFundsTableRow[]>(
    () => dedupeInvestFunds(funds).map((fund) => ({ ...fund, tableId: fund.product_id })),
    [funds],
  );

  const sortedRows = useMemo(() => {
    const column = sortDescriptor.column;
    const direction = sortDescriptor.direction === "descending" ? -1 : 1;

    return [...rows].sort((a, b) => {
      if (column === "name") {
        return a.name.localeCompare(b.name) * direction;
      }
      if (column === "category") {
        return displayCategoryLabel(a).localeCompare(displayCategoryLabel(b)) * direction;
      }
      if (column === "return_1y" || column === "return_3y" || column === "return_5y") {
        const key = column as "return_1y" | "return_3y" | "return_5y";
        const first = a.returns[key] ?? Number.NEGATIVE_INFINITY;
        const second = b.returns[key] ?? Number.NEGATIVE_INFINITY;
        return (first - second) * direction;
      }
      return 0;
    });
  }, [rows, sortDescriptor]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <TableCard.Root
        size="sm"
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 shadow-none"
      >
        <div
          ref={scrollContainerRef}
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-auto overscroll-y-contain overscroll-x-auto",
            refetching && "pointer-events-none opacity-60",
          )}
        >
          <Table
            aria-label={copy.mutualFunds.allFundsTitle}
            size="sm"
            className={TABLE_LAYOUT_CLASS}
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
          >
            <Table.Header bordered={false} className={HEADER_ROW_CLASS}>
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
                <span className="text-compact font-semibold tracking-tight text-foreground">Fund Name</span>
                <span className="text-caption font-medium text-muted-foreground tabular-nums">
                  ({totalCount} results)
                </span>
              </Table.Head>
              <Table.Head
                id="category"
                label={copy.mutualFunds.tableCategory}
                allowsSorting
                className={cn(COL_CATEGORY, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
              <Table.Head
                id="return_1y"
                label={copy.mutualFunds.tableReturn1y}
                allowsSorting
                className={cn(COL_RETURN, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
              <Table.Head
                id="return_3y"
                label={copy.mutualFunds.tableReturn3y}
                allowsSorting
                className={cn(COL_RETURN, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
              <Table.Head
                id="return_5y"
                label={copy.mutualFunds.tableReturn5y}
                allowsSorting
                className={cn(COL_RETURN, HEADER_CELL_CLASS, HEADER_LABEL_CLASS, HEADER_SURFACE_CLASS)}
              />
            </Table.Header>

            {sortedRows.length > 0 ? (
            <Table.Body className="[&>tr:first-child>td]:border-t-0" items={sortedRows}>
              {(fund) => {
                function navigateToFund() {
                  if (onRowClick) {
                    onRowClick(fund);
                    return;
                  }
                  router.push(mfFundHref(fund));
                }

                return (
                <Table.Row
                  id={fund.tableId}
                  className={cn(
                    "cursor-pointer",
                    selectedProductId === fund.product_id && "bg-muted/50",
                  )}
                  onAction={navigateToFund}
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
                );
              }}
            </Table.Body>
            ) : null}
          </Table>

          {sortedRows.length === 0 ? (
            <MfFundsTableEmptyState
              title={emptyTitle ?? copy.mutualFunds.allFundsEmpty}
              description={emptyDescription ?? copy.mutualFunds.allFundsEmptyDescription}
            />
          ) : null}

          {sortedRows.length > 0 && hasMore ? (
            <div ref={loadMoreRef} className="h-px shrink-0" aria-hidden="true" />
          ) : null}

          {sortedRows.length > 0 && hasMore ? (
            <div
              className="flex h-12 shrink-0 items-center justify-center gap-2 border-t border-border text-caption text-muted-foreground"
              aria-live="polite"
              aria-busy={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {copy.mutualFunds.loadingMore}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </TableCard.Root>
    </div>
  );
}
