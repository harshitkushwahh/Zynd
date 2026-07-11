"use client";

import { ChevronLeft, ChevronRight } from "@untitledui/icons";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 border-t border-border px-4 py-3 md:px-5 md:pt-3 md:pb-4",
        className
      )}
    >
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
            <span key={`ellipsis-${index}`} className="flex size-8 items-center justify-center text-caption text-muted-foreground">
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
          )
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
