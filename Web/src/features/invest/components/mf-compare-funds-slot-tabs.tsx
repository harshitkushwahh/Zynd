"use client";

import { useEffect, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Loader2, Search } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FieldMessage } from "@/components/ui/ui-message";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import { MfFundAmcAvatar, MfFundSearchResultItem } from "@/features/invest/components/mf-fund-search-ui";
import { MF_FUND_SEARCH_MIN_CHARS, useMfFundSearch } from "@/features/invest/lib/mf-fund-search";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const SLOT_COUNT = 3;

type CompareFundsSlotTabListProps = {
  slots: Array<InvestFundSummary | null>;
  activeSlot: number;
  onActiveSlotChange: (slot: number) => void;
};

type FundSlotTabProps = {
  slotIndex: number;
  fund: InvestFundSummary | null;
  isActive: boolean;
  onSelect: () => void;
};

function FundSlotTab({ slotIndex, fund, isActive, onSelect }: FundSlotTabProps) {
  const tabLabel = copy.mutualFunds.compareSelectFund.replace("{slot}", String(slotIndex + 1));

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={copy.mutualFunds.compareTabAria(slotIndex + 1)}
      onClick={onSelect}
      className={cn(
        "flex min-w-[8.5rem] flex-1 items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-colors",
        isActive
          ? "border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_6%,var(--card))]"
          : "border-[var(--sip-panel-border)] bg-background hover:bg-muted/30",
      )}
    >
      {fund ? (
        <MfFundAmcAvatar amcLogoUrl={fund.amc_logo_url} amcName={fund.amc_name} size="sm" />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-[11px] font-semibold text-muted-foreground">
          {slotIndex + 1}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-caption font-medium text-foreground">{tabLabel}</span>
        <span
          className={cn(
            "block truncate text-[10px]",
            fund ? "text-muted-foreground" : "text-muted-foreground/70",
          )}
        >
          {fund ? fund.name : copy.mutualFunds.compareAddFund}
        </span>
      </span>
    </button>
  );
}

export function CompareFundsSlotTabList({
  slots,
  activeSlot,
  onActiveSlotChange,
}: CompareFundsSlotTabListProps) {
  return (
    <div
      role="tablist"
      aria-label={copy.mutualFunds.compareSelectTitle}
      className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]"
    >
      {Array.from({ length: SLOT_COUNT }, (_, index) => (
        <FundSlotTab
          key={index}
          slotIndex={index}
          fund={slots[index] ?? null}
          isActive={activeSlot === index}
          onSelect={() => onActiveSlotChange(index)}
        />
      ))}
    </div>
  );
}

type CompareFundSlotSearchProps = {
  activeSlot: number;
  slots: Array<InvestFundSummary | null>;
  onSlotsChange: (slots: Array<InvestFundSummary | null>) => void;
  excludeProductIds: string[];
};

export function CompareFundSlotSearch({
  activeSlot,
  slots,
  onSlotsChange,
  excludeProductIds,
}: CompareFundSlotSearchProps) {
  const [query, setQuery] = useState("");
  const activeFund = slots[activeSlot] ?? null;
  const pickerExclude = excludeProductIds.filter((id) => id !== activeFund?.product_id);
  const trimmedQuery = query.trim();

  const { results, searching, error, isActive } = useMfFundSearch({
    query,
    enabled: true,
    excludeProductIds: pickerExclude,
  });

  useEffect(() => {
    setQuery("");
  }, [activeSlot]);

  function handleSelect(fund: InvestFundSummary) {
    onSlotsChange(slots.map((slot, index) => (index === activeSlot ? fund : slot)));
    setQuery("");
  }

  const showDropdown =
    trimmedQuery.length >= MF_FUND_SEARCH_MIN_CHARS || searching || Boolean(error);

  return (
    <div className="relative w-full min-w-0 max-w-full">
      <Command
        shouldFilter={false}
        className="w-full min-w-0 max-w-full overflow-visible rounded-none bg-transparent"
      >
        <div className="relative w-full min-w-0 max-w-full">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2.25}
          />
          <CommandPrimitive.Input
            value={query}
            onValueChange={setQuery}
            placeholder={copy.mutualFunds.calculatorSelectFund}
            className={cn(
              "box-border flex h-11 w-full min-w-0 max-w-full border border-input bg-transparent py-2 pr-3 pl-10 text-compact outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
              ZYND_3XL_RADIUS_CLASS,
            )}
          />
        </div>

        {showDropdown ? (
          <CommandList
            className={cn(
              "absolute top-full right-0 left-0 z-20 mt-2 max-h-80 w-full min-w-0 overflow-hidden border border-border/70 bg-card shadow-zynd-mid",
              ZYND_3XL_RADIUS_CLASS,
            )}
          >
            {searching ? (
              <div className="flex items-center gap-2 px-4 py-4 text-compact text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {copy.mutualFunds.searching}
              </div>
            ) : null}

            {error ? (
              <div className="px-4 py-2">
                <FieldMessage message={error} className="mt-0" />
              </div>
            ) : null}

            {!searching && isActive && results.length === 0 ? (
              <CommandEmpty>{copy.mutualFunds.calculatorSearchEmpty}</CommandEmpty>
            ) : null}

            {!searching && results.length > 0 ? (
              <CommandGroup className="p-1.5">
                {results.map((fund) => (
                  <CommandItem
                    key={fund.product_id}
                    value={fund.product_id}
                    className="py-2.5"
                    onSelect={() => handleSelect(fund)}
                  >
                    <MfFundSearchResultItem fund={fund} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        ) : null}
      </Command>
    </div>
  );
}
