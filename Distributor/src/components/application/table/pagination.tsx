"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DISTRIBUTOR_TABLE_PAGINATION_CLASS } from "@/lib/distributor-layout";

export const DISTRIBUTOR_TABLE_PAGE_SIZE = 10;

export type TablePaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Render pagination footer even when there is only one page */
  alwaysVisible?: boolean;
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

type PaginationPageMinimalCenterProps = {
  page: number;
  total: number;
  onPageChange?: (page: number) => void;
  className?: string;
};

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

export function PaginationPageMinimalCenter({
  page,
  total,
  onPageChange,
  className,
}: PaginationPageMinimalCenterProps) {
  const pages = buildPageItems(page, total);

  return (
    <div className={cn(DISTRIBUTOR_TABLE_PAGINATION_CLASS, className)}>
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
