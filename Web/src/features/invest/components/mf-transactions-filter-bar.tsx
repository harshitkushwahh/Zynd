"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMPTY_MF_TRANSACTION_FILTERS,
  hasActiveMfTransactionFilters,
  type MfTransactionFilters,
  type MfTransactionStatusFilter,
  type MfTransactionTypeFilter,
} from "@/features/invest/lib/mf-transaction-filters";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfTransactionsFilterBarProps = {
  filters: MfTransactionFilters;
  onChange: (filters: MfTransactionFilters) => void;
};

const ALL_OPTION_VALUE = "__all__";

const TYPE_OPTIONS: Array<{ value: MfTransactionTypeFilter; label: string }> = [
  { value: "lumpsum", label: copy.transactions.filterLumpsum },
  { value: "sip", label: copy.transactions.filterSip },
  { value: "redemption", label: copy.transactions.filterRedemption },
];

const STATUS_OPTIONS: Array<{ value: MfTransactionStatusFilter; label: string }> = [
  { value: "processing", label: copy.transactions.filterProcessing },
  { value: "completed", label: copy.transactions.filterCompleted },
  { value: "failed", label: copy.transactions.filterFailed },
];

const QUICK_PILLS: Array<{
  id: "lumpsum" | "sip" | "failed";
  label: string;
  apply: (filters: MfTransactionFilters) => MfTransactionFilters;
  isActive: (filters: MfTransactionFilters) => boolean;
}> = [
  {
    id: "lumpsum",
    label: copy.transactions.filterLumpsum,
    isActive: (filters) => filters.type === "lumpsum",
    apply: (filters) => ({
      ...filters,
      type: filters.type === "lumpsum" ? "all" : "lumpsum",
    }),
  },
  {
    id: "sip",
    label: copy.transactions.filterSip,
    isActive: (filters) => filters.type === "sip",
    apply: (filters) => ({
      ...filters,
      type: filters.type === "sip" ? "all" : "sip",
    }),
  },
  {
    id: "failed",
    label: copy.transactions.filterFailed,
    isActive: (filters) => filters.status === "failed",
    apply: (filters) => ({
      ...filters,
      status: filters.status === "failed" ? "all" : "failed",
    }),
  },
];

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onValueChange: (value: T) => void;
}) {
  const selectValue = value === "all" ? ALL_OPTION_VALUE : value;

  return (
    <Select
      value={selectValue}
      onValueChange={(next) =>
        onValueChange((next === ALL_OPTION_VALUE ? "all" : next) as T)
      }
    >
      <SelectTrigger size="sm" className="min-w-[8.5rem] bg-background">
        <SelectValue placeholder={label}>
          {value === "all"
            ? label
            : options.find((option) => option.value === value)?.label}
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

export function MfTransactionsFilterBar({ filters, onChange }: MfTransactionsFilterBarProps) {
  const canClear = hasActiveMfTransactionFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        label={copy.transactions.filterTypeLabel}
        value={filters.type}
        options={TYPE_OPTIONS}
        onValueChange={(type) => onChange({ ...filters, type })}
      />
      <FilterSelect
        label={copy.transactions.filterStatusLabel}
        value={filters.status}
        options={STATUS_OPTIONS}
        onValueChange={(status) => onChange({ ...filters, status })}
      />

      <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

      {QUICK_PILLS.map((pill) => {
        const active = pill.isActive(filters);
        return (
          <button
            key={pill.id}
            type="button"
            onClick={() => onChange(pill.apply(filters))}
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
        onClick={() => onChange(EMPTY_MF_TRANSACTION_FILTERS)}
      >
        {copy.mutualFunds.filterClearAll}
      </Button>
    </div>
  );
}
