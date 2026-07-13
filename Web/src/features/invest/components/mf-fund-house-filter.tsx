"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFundHouseFilterProps = {
  amcs: Array<{ slug: string; name: string }>;
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
};

export function MfFundHouseFilter({ amcs, selectedSlugs, onChange }: MfFundHouseFilterProps) {
  const [query, setQuery] = useState("");

  const filteredAmcs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return amcs;
    return amcs.filter((amc) => amc.name.toLowerCase().includes(normalized));
  }, [amcs, query]);

  const triggerLabel =
    selectedSlugs.length === 0
      ? copy.mutualFunds.filterFundHouse
      : copy.mutualFunds.filterFundHouseSelected.replace("{count}", String(selectedSlugs.length));

  function toggleSlug(slug: string) {
    onChange(
      selectedSlugs.includes(slug)
        ? selectedSlugs.filter((item) => item !== slug)
        : [...selectedSlugs, slug],
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "flex h-7 min-w-[8.5rem] items-center justify-between gap-1.5 rounded-[var(--radius-control)] border border-input bg-background py-2 pr-2 pl-2.5 text-compact whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-200 ease-out outline-none select-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/30 data-popup-open:[&_svg]:rotate-180 dark:bg-input/30 dark:hover:bg-input/50",
        )}
      >
        <span className={cn(selectedSlugs.length === 0 && "text-muted-foreground")}>{triggerLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 gap-0 p-0">
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.mutualFunds.filterFundHouseSearch}
              className="h-8 pl-8"
              aria-label={copy.mutualFunds.filterFundHouseSearch}
            />
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto p-1">
          {filteredAmcs.length === 0 ? (
            <p className="px-2 py-3 text-center text-caption text-muted-foreground">
              {copy.mutualFunds.filterFundHouseEmpty}
            </p>
          ) : (
            filteredAmcs.map((amc) => {
              const checked = selectedSlugs.includes(amc.slug);
              return (
                <label
                  key={amc.slug}
                  className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSlug(amc.slug)}
                    className="mt-0.5 size-3.5 shrink-0 rounded border-input accent-primary"
                  />
                  <span className="text-compact leading-snug text-foreground">{amc.name}</span>
                </label>
              );
            })
          )}
        </div>

        {selectedSlugs.length > 0 ? (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full text-muted-foreground"
              onClick={() => onChange([])}
            >
              {copy.mutualFunds.filterFundHouseClear}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
