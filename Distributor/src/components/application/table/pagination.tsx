"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DISTRIBUTOR_TABLE_PAGINATION_CLASS } from "@/lib/distributor-layout";

export const DISTRIBUTOR_TABLE_PAGE_SIZE = 10;

export const DISTRIBUTOR_TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type TablePaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Render pagination footer even when there is only one page */
  alwaysVisible?: boolean;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
  /** Total rows before pagination (for range label) */
  totalItemCount?: number;
};

export function paginateTableItems<T>(
  items: T[],
  page: number,
  pageSize = DISTRIBUTOR_TABLE_PAGE_SIZE,
): { pageItems: T[]; totalPages: number; safePage: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages,
    safePage,
  };
}

export function useDistributorTablePagination<T>(
  items: T[],
  options?: {
    initialPageSize?: number;
    pageSizeOptions?: readonly number[];
    alwaysVisible?: boolean;
  },
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(
    options?.initialPageSize ?? DISTRIBUTOR_TABLE_PAGE_SIZE,
  );
  const pageSizeOptions = options?.pageSizeOptions ?? DISTRIBUTOR_TABLE_PAGE_SIZE_OPTIONS;

  const { pageItems, totalPages, safePage } = useMemo(
    () => paginateTableItems(items, page, pageSize),
    [items, page, pageSize],
  );

  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  const pagination = useMemo<TablePaginationProps>(
    () => ({
      page: safePage,
      totalPages,
      onPageChange: setPage,
      pageSize,
      pageSizeOptions,
      onPageSizeChange: handlePageSizeChange,
      totalItemCount: items.length,
      alwaysVisible: options?.alwaysVisible ?? items.length > 0,
    }),
    [
      safePage,
      totalPages,
      pageSize,
      pageSizeOptions,
      handlePageSizeChange,
      items.length,
      options?.alwaysVisible,
    ],
  );

  return { pageItems, pagination, setPage, pageSize, setPageSize };
}

function buildPageItems(page: number, total: number) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1) as Array<number | "ellipsis">;
  }

  if (page <= 3) {
    return [1, 2, 3, 4, "ellipsis", total] as const;
  }

  if (page >= total - 2) {
    return [1, "ellipsis", total - 3, total - 2, total - 1, total] as const;
  }

  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", total] as const;
}

function formatPageRange(
  page: number,
  pageSize: number,
  totalItemCount: number,
): string | null {
  if (totalItemCount <= 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItemCount);
  return `${start}–${end} of ${totalItemCount}`;
}

type PaginationPageMinimalCenterProps = {
  page: number;
  total: number;
  onPageChange?: (page: number) => void;
  className?: string;
};

export function PaginationPageMinimalCenter({
  page,
  total,
  onPageChange,
  className,
}: PaginationPageMinimalCenterProps) {
  const pages = buildPageItems(page, total);

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5"
        disabled={page <= 1}
        onClick={() => onPageChange?.(Math.max(1, page - 1))}
      >
        <ChevronLeft className="size-4" />
        <span className="hidden md:inline">Previous</span>
      </Button>

      <div className="flex items-center gap-0.5">
        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="flex size-8 items-center justify-center text-caption text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              type="button"
              variant={page === item ? "default" : "ghost"}
              size="icon-sm"
              className={cn("min-w-8", page === item && "pointer-events-none")}
              onClick={() => onPageChange?.(item)}
            >
              {item}
            </Button>
          ),
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5"
        disabled={page >= total}
        onClick={() => onPageChange?.(Math.min(total, page + 1))}
      >
        <span className="hidden md:inline">Next</span>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

type DistributorTablePaginationFooterProps = TablePaginationProps;

export function DistributorTablePaginationFooter({
  page,
  totalPages,
  onPageChange,
  pageSize = DISTRIBUTOR_TABLE_PAGE_SIZE,
  pageSizeOptions = DISTRIBUTOR_TABLE_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  totalItemCount,
}: DistributorTablePaginationFooterProps) {
  const rangeLabel =
    totalItemCount != null ? formatPageRange(page, pageSize, totalItemCount) : null;
  const showPageSize = onPageSizeChange != null && pageSizeOptions.length > 0;

  return (
    <footer className={DISTRIBUTOR_TABLE_PAGINATION_CLASS} aria-label="Table pagination">
      <div className="distributor-table-pagination__leading">
        {showPageSize ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption text-muted-foreground">Results per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                const next = Number(value);
                if (!Number.isNaN(next)) onPageSizeChange(next);
              }}
            >
              <SelectTrigger size="sm" className="min-w-[4.25rem]" aria-label="Results per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {rangeLabel ? (
        <p className="distributor-table-pagination__range text-caption text-muted-foreground">
          {rangeLabel}
        </p>
      ) : (
        <span className="distributor-table-pagination__range" aria-hidden />
      )}

      <PaginationPageMinimalCenter
        page={page}
        total={totalPages}
        onPageChange={onPageChange}
        className="distributor-table-pagination__controls"
      />
    </footer>
  );
}

export function shouldShowDistributorTablePagination(
  pagination: TablePaginationProps | undefined,
): pagination is TablePaginationProps {
  if (!pagination) return false;
  if (pagination.alwaysVisible) return true;
  if (pagination.totalPages > 1) return true;
  if (pagination.onPageSizeChange != null && (pagination.totalItemCount ?? 0) > 0) return true;
  return false;
}
