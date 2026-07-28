"use client";

import type { ReactNode } from "react";

import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { cn } from "@/lib/utils";

type DistributorHeadListToolbarProps = {
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: ReactNode;
  className?: string;
};

export function DistributorHeadListToolbar({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  filters,
  className,
}: DistributorHeadListToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <AdminSearchInput
        containerClassName="w-full max-w-md"
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {filters ? (
        <div className="flex flex-wrap items-center justify-end gap-2">{filters}</div>
      ) : null}
    </div>
  );
}
