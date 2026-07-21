"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  ADMIN_TABLE_MIN_WIDTH,
  type AdminTableMinWidth,
} from "@/components/ui/admin-design-tokens";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const ADMIN_TABLE_PAGE_SIZE = 10;

export function AdminDataTable({
  children,
  minWidth = "default",
  minWidthClassName,
  className,
}: {
  children: React.ReactNode;
  minWidth?: AdminTableMinWidth;
  minWidthClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-[var(--radius-card)] border border-border", className)}>
      <table
        className={cn(
          "w-full text-left text-compact",
          minWidthClassName ?? ADMIN_TABLE_MIN_WIDTH[minWidth],
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function AdminTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-border bg-muted/30 text-caption text-muted-foreground">
      {children}
    </thead>
  );
}

export function AdminTableHeadCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

export function AdminTableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function AdminTableRow({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-b-0 transition-colors",
        onClick && "cursor-pointer hover:bg-muted/30",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function AdminTableCell({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={cn("px-4 py-3", className)} colSpan={colSpan}>
      {children}
    </td>
  );
}

export function AdminTableStateRow({
  colSpan,
  children,
  message,
}: {
  colSpan: number;
  children?: React.ReactNode;
  message?: React.ReactNode;
}) {
  return (
    <AdminTableRow>
      <AdminTableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
        {message ?? children}
      </AdminTableCell>
    </AdminTableRow>
  );
}

type AdminTableSkeletonRowsProps = {
  columns: number;
  rows?: number;
  dense?: boolean;
};

export function AdminTableSkeletonRows({
  columns,
  rows = 6,
  dense = false,
}: AdminTableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <AdminTableRow key={`skeleton-row-${rowIndex}`}>
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <AdminTableCell key={`skeleton-cell-${rowIndex}-${columnIndex}`}>
              {columnIndex === 0 && !dense ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-control" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-36 max-w-full" />
                    <Skeleton className="h-3 w-24 max-w-full" />
                  </div>
                </div>
              ) : (
                <Skeleton
                  className={cn(
                    "h-4 max-w-full",
                    columnIndex === columns - 1 ? "ml-auto w-16" : "w-28",
                  )}
                />
              )}
            </AdminTableCell>
          ))}
        </AdminTableRow>
      ))}
    </>
  );
}

type AdminTableRowsProps = {
  children: React.ReactNode;
  colSpan: number;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: React.ReactNode;
  skeletonRows?: number;
  dense?: boolean;
};

export function AdminTableRows({
  children,
  colSpan,
  loading = false,
  isEmpty = false,
  emptyMessage = "No data.",
  skeletonRows = 6,
  dense = false,
}: AdminTableRowsProps) {
  if (loading) {
    return <AdminTableSkeletonRows columns={colSpan} rows={skeletonRows} dense={dense} />;
  }

  if (isEmpty) {
    return <AdminTableStateRow colSpan={colSpan} message={emptyMessage} />;
  }

  return children;
}

export function AdminTablePagination({
  page,
  totalPages,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  disabled = false,
  className,
}: {
  page: number;
  totalPages?: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const showTotalPages = totalPages != null && totalPages > 0;

  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || !hasPrevious}
        onClick={onPrevious}
      >
        <ChevronLeft className="size-3.5" />
        Previous
      </Button>
      <span className="px-1 text-caption text-muted-foreground">
        Page {page + 1}
        {showTotalPages ? ` of ${totalPages}` : ""}
      </span>
      <Button variant="outline" size="sm" disabled={disabled || !hasNext} onClick={onNext}>
        Next
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}

export function getOffsetPage(offset: number, pageSize = ADMIN_TABLE_PAGE_SIZE) {
  return Math.floor(offset / pageSize);
}

export function paginateItems<T>(items: T[], page: number, pageSize = ADMIN_TABLE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    hasPrevious: safePage > 0,
    hasNext: (safePage + 1) * pageSize < items.length,
  };
}
