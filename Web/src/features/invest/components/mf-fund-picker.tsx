"use client";

import { useState } from "react";
import { ChevronsUpDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import {
  MfFundAmcAvatar,
  MfFundSearchList,
} from "@/features/invest/components/mf-fund-search-ui";
import { useMfFundSearch } from "@/features/invest/lib/mf-fund-search";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const EMPTY_EXCLUDE_IDS: string[] = [];

type MfFundPickerProps = {
  value: InvestFundSummary | null;
  onChange: (fund: InvestFundSummary | null) => void;
  excludeProductIds?: string[];
  placeholder?: string;
  className?: string;
  showClear?: boolean;
};

export function MfFundPicker({
  value,
  onChange,
  excludeProductIds = EMPTY_EXCLUDE_IDS,
  placeholder = copy.mutualFunds.calculatorSelectFund,
  className,
  showClear = true,
}: MfFundPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { results, searching, error, isActive } = useMfFundSearch({
    query,
    enabled: open,
    excludeProductIds,
  });

  function handleSelect(fund: InvestFundSummary) {
    onChange(fund);
    setOpen(false);
    setQuery("");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          className={cn(
            "flex h-11 w-full min-w-0 items-center gap-2.5 rounded-[var(--radius-control)] border border-input bg-background px-3 text-left text-compact transition-colors",
            "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            open && "border-ring ring-[3px] ring-ring/50",
          )}
        >
          {value ? (
            <>
              <MfFundAmcAvatar
                amcLogoUrl={value.amc_logo_url}
                amcName={value.amc_name}
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{value.name}</span>
            </>
          ) : (
            <>
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{placeholder}</span>
            </>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-medium)] border border-border p-0 shadow-zynd-mid"
          align="start"
        >
          <Command shouldFilter={false}>
            <MfFundSearchList
              query={query}
              onQueryChange={setQuery}
              results={isActive ? results : []}
              searching={searching}
              error={error}
              onSelect={handleSelect}
            />
          </Command>
        </PopoverContent>
      </Popover>

      {showClear && value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={copy.mutualFunds.compareRemoveFund}
          onClick={() => onChange(null)}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
