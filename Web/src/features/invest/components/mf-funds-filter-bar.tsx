"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InvestCategory } from "@/features/invest/api/invest-api";
import {
  EMPTY_MF_FUND_FILTERS,
  MF_FUND_PILL_OPTIONS,
  hasActiveMfFundFilters,
  toggleMfFundPill,
  type MfFundFilters,
} from "@/features/invest/lib/mf-fund-filters";
import { MfFundHouseFilter } from "@/features/invest/components/mf-fund-house-filter";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFundsFilterBarProps = {
  filters: MfFundFilters;
  categories: InvestCategory[];
  amcs: Array<{ slug: string; name: string }>;
  onChange: (filters: MfFundFilters) => void;
};

const ALL_OPTION_VALUE = "__all__";

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onValueChange,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string | null) => void;
}) {
  const selectValue = value ?? ALL_OPTION_VALUE;

  return (
    <Select
      value={selectValue}
      onValueChange={(next) => onValueChange(next === ALL_OPTION_VALUE ? null : next)}
    >
      <SelectTrigger size="sm" className="min-w-[8.5rem] bg-background">
        <SelectValue placeholder={placeholder}>
          {value ? options.find((option) => option.value === value)?.label : label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_OPTION_VALUE}>{copy.mutualFunds.filterAll}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MfFundsFilterBar({
  filters,
  categories,
  amcs,
  onChange,
}: MfFundsFilterBarProps) {
  const canClear = hasActiveMfFundFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        label={copy.mutualFunds.filterCategories}
        placeholder={copy.mutualFunds.filterCategories}
        value={filters.categorySlug}
        options={categories.map((category) => ({
          value: category.slug,
          label: category.name,
        }))}
        onValueChange={(categorySlug) => onChange({ ...filters, categorySlug })}
      />
      <MfFundHouseFilter
        amcs={amcs}
        selectedSlugs={filters.amcSlugs}
        onChange={(amcSlugs) => onChange({ ...filters, amcSlugs })}
      />

      <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

      {MF_FUND_PILL_OPTIONS.map((pill) => {
        const active = filters.pills.includes(pill.id);
        return (
          <button
            key={pill.id}
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                pills: toggleMfFundPill(filters.pills, pill.id),
              })
            }
            className={cn(
              "rounded-full border px-3 py-1.5 text-compact transition-colors",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {pill.label}
          </button>
        );
      })}

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto text-muted-foreground"
        disabled={!canClear}
        onClick={() => onChange(EMPTY_MF_FUND_FILTERS)}
      >
        {copy.mutualFunds.filterClearAll}
      </Button>
    </div>
  );
}
