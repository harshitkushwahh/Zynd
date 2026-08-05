"use client";

import {
  hasSufficientNavHistoryForRange,
  MF_NAV_RANGE_OPTIONS,
  type MfNavChartPoint,
  type MfNavRange,
} from "@/features/invest/lib/mf-nav-history";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfNavRangeTabsProps = {
  value: MfNavRange;
  onChange: (value: MfNavRange) => void;
  allPoints?: MfNavChartPoint[];
  isRangeAvailable?: (range: MfNavRange) => boolean;
  ariaLabel?: string;
};

export function MfNavRangeTabs({
  value,
  onChange,
  allPoints = [],
  isRangeAvailable,
  ariaLabel = copy.mutualFunds.performanceTitle,
}: MfNavRangeTabsProps) {
  const canSelectRange = (range: MfNavRange) =>
    isRangeAvailable?.(range) ?? hasSufficientNavHistoryForRange(allPoints, range);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 rounded-[var(--radius-control)] border border-border/80 bg-muted/20 p-1"
    >
      {MF_NAV_RANGE_OPTIONS.map((option) => {
        const active = value === option.id;
        const enabled = canSelectRange(option.id);

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={!enabled}
            disabled={!enabled}
            onClick={() => {
              if (enabled) onChange(option.id);
            }}
            className={cn(
              "min-w-[2.75rem] rounded-[var(--radius-control)] px-3 py-1.5 text-caption font-medium transition-colors",
              active && enabled
                ? "bg-foreground text-background shadow-zynd-low"
                : enabled
                  ? "text-muted-foreground hover:text-foreground"
                  : "cursor-not-allowed text-muted-foreground/45",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
