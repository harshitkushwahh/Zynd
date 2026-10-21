"use client";

import { LineChart, type LucideIcon } from "lucide-react";

import {
  mfFundCategoryMetaFor,
  resolveMfFundCategoryFromSlug,
} from "@/features/invest/components/mf-fund-category-badge";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfCategoryBrowseEmptyStateProps = {
  categorySlug: string;
  className?: string;
  /** Dashed border panel (category landing sections). */
  bordered?: boolean;
};

function resolveCategoryEmptyIcon(categorySlug: string): LucideIcon {
  const kind = resolveMfFundCategoryFromSlug(categorySlug);
  if (kind) return mfFundCategoryMetaFor(kind).icon;
  return LineChart;
}

export function MfCategoryBrowseEmptyState({
  categorySlug,
  className,
  bordered = false,
}: MfCategoryBrowseEmptyStateProps) {
  const Icon = resolveCategoryEmptyIcon(categorySlug);

  return (
    <div
      className={cn(
        "flex min-h-[12rem] flex-col items-center justify-center px-6 py-8 text-center",
        bordered && "min-h-[120px] rounded-[var(--radius-medium)] border border-dashed border-border",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full",
          "bg-muted/40 text-muted-foreground ring-1 ring-inset ring-border/70",
        )}
      >
        <Icon className="size-6 opacity-80" strokeWidth={2} aria-hidden />
      </div>
      <p className="mt-4 max-w-sm text-compact leading-relaxed text-muted-foreground">
        {copy.mutualFunds.categoryEmpty}
      </p>
    </div>
  );
}
