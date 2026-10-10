"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { DISTRIBUTOR_TABLE_SEARCH_CARD_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type DistributorTableSearchCardProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  variant?: "card" | "inline";
  "aria-label"?: string;
};

export function DistributorTableSearchCard({
  value,
  onChange,
  placeholder = "Search…",
  className,
  variant = "card",
  "aria-label": ariaLabel = "Search table",
}: DistributorTableSearchCardProps) {
  const isInline = variant === "inline";

  return (
    <div
      className={cn(
        isInline ? "distributor-table-search-field" : DISTRIBUTOR_TABLE_SEARCH_CARD_CLASS,
        className,
      )}
    >
      <Search className="distributor-table-search-card__icon size-3.5 shrink-0" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="distributor-table-search-card__input h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
