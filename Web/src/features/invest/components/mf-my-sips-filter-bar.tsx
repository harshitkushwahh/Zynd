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
  EMPTY_MF_SIP_FILTERS,
  hasActiveMfSipFilters,
  type MfSipFilters,
  type MfSipStatusFilter,
} from "@/features/invest/lib/mf-sip-filters";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfMySipsFilterBarProps = {
  filters: MfSipFilters;
  onChange: (filters: MfSipFilters) => void;
};

const ALL_OPTION_VALUE = "__all__";

const STATUS_OPTIONS: Array<{ value: MfSipStatusFilter; label: string }> = [
  { value: "active", label: copy.mySips.filterActive },
  { value: "pending", label: copy.mySips.filterPending },
  { value: "cancelled", label: copy.mySips.filterCancelled },
  { value: "failed", label: copy.mySips.filterFailed },
];

const QUICK_PILLS: Array<{
  id: "active" | "pending" | "failed";
  label: string;
  apply: (filters: MfSipFilters) => MfSipFilters;
  isActive: (filters: MfSipFilters) => boolean;
}> = [
  {
    id: "active",
    label: copy.mySips.filterActive,
    isActive: (filters) => filters.status === "active",
    apply: (filters) => ({
      ...filters,
      status: filters.status === "active" ? "all" : "active",
    }),
  },
  {
    id: "pending",
    label: copy.mySips.filterPending,
    isActive: (filters) => filters.status === "pending",
    apply: (filters) => ({
      ...filters,
      status: filters.status === "pending" ? "all" : "pending",
    }),
  },
  {
    id: "failed",
    label: copy.mySips.filterFailed,
    isActive: (filters) => filters.status === "failed",
    apply: (filters) => ({
      ...filters,
      status: filters.status === "failed" ? "all" : "failed",
    }),
  },
];

export function MfMySipsFilterBar({ filters, onChange }: MfMySipsFilterBarProps) {
  const canClear = hasActiveMfSipFilters(filters);
  const selectValue = filters.status === "all" ? ALL_OPTION_VALUE : filters.status;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={selectValue}
        onValueChange={(next) =>
          onChange({
            ...filters,
            status: (next === ALL_OPTION_VALUE ? "all" : next) as MfSipStatusFilter,
          })
        }
      >
        <SelectTrigger size="sm" className="min-w-[8.5rem] bg-background">
          <SelectValue placeholder={copy.mySips.filterStatusLabel}>
            {filters.status === "all"
              ? copy.mySips.filterStatusLabel
              : STATUS_OPTIONS.find((option) => option.value === filters.status)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_OPTION_VALUE}>{copy.mutualFunds.filterAll}</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
        onClick={() => onChange(EMPTY_MF_SIP_FILTERS)}
      >
        {copy.mutualFunds.filterClearAll}
      </Button>
    </div>
  );
}
