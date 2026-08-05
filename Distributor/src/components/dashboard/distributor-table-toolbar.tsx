"use client";

import type { ComponentProps, ReactNode } from "react";

import { DISTRIBUTOR_TABLE_FILTERS_CARD_CLASS } from "@/lib/distributor-layout";

import { ClearAllButton } from "@/components/ui/clear-all-button";
import { cn } from "@/lib/utils";

type DistributorTableToolbarProps = {
  children: ReactNode;
  /** Actions rendered inline on the left, outside the filters pill. */
  leading?: ReactNode;
  search?: ReactNode;
  onClearAll: () => void;
  clearDisabled: boolean;
  clearVariant?: ComponentProps<typeof ClearAllButton>["variant"];
  clearSize?: ComponentProps<typeof ClearAllButton>["size"];
  className?: string;
  /** @default true */
  showClearAll?: boolean;
};

export function DistributorTableToolbar({
  children,
  leading,
  search,
  onClearAll,
  clearDisabled,
  clearVariant = "ghost",
  clearSize = "sm",
  className,
  showClearAll = true,
}: DistributorTableToolbarProps) {
  return (
    <div className={cn("distributor-table-toolbar", className)}>
      {leading ? <div className="distributor-table-toolbar__leading">{leading}</div> : null}
      <div className={DISTRIBUTOR_TABLE_FILTERS_CARD_CLASS}>
        <div className="distributor-table-toolbar__filters">{children}</div>
      </div>
      <div className="distributor-table-toolbar__trailing">
        {search}
        {showClearAll ? (
          <ClearAllButton
            onClear={onClearAll}
            disabled={clearDisabled}
            variant={clearVariant}
            size={clearSize}
            className="shrink-0 self-center"
          />
        ) : null}
      </div>
    </div>
  );
}
