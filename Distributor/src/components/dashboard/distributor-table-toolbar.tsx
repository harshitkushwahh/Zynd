"use client";

import type { ReactNode } from "react";

import { ClearAllButton } from "@/components/ui/clear-all-button";

type DistributorTableToolbarProps = {
  children: ReactNode;
  onClearAll: () => void;
  clearDisabled: boolean;
};

export function DistributorTableToolbar({
  children,
  onClearAll,
  clearDisabled,
}: DistributorTableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      <ClearAllButton onClear={onClearAll} disabled={clearDisabled} />
    </div>
  );
}
