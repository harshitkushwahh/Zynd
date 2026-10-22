"use client";

import { useMemo } from "react";

import {
  hasSufficientNavHistoryForRange,
  MF_NAV_RANGE_OPTIONS,
  type MfNavChartPoint,
  type MfNavRange,
} from "@/features/invest/lib/mf-nav-history";
import { SlidingPillTabList } from "@/shared/ui/sliding-pill-tab-list";
import { copy } from "@/shared/config/copy";

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
  const tabs = useMemo(
    () =>
      MF_NAV_RANGE_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
        disabled: !(isRangeAvailable?.(option.id) ?? hasSufficientNavHistoryForRange(allPoints, option.id)),
      })),
    [allPoints, isRangeAvailable],
  );

  return (
    <SlidingPillTabList
      ariaLabel={ariaLabel}
      tabs={tabs}
      value={value}
      onChange={onChange}
      className="max-w-full"
    />
  );
}
