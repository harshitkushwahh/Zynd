"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  ADMIN_TABLE_MIN_WIDTH,
  type AdminTableMinWidth,
} from "@/components/ui/admin-design-tokens";
import { Button } from "@/components/ui/button";
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
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <AdminTableRow>
      <AdminTableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
        {children}
      </AdminTableCell>
    </AdminTableRow>
  );
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
