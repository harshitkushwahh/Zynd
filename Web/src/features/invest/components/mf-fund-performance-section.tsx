"use client";

import { useEffect, useMemo, useState } from "react";

import type { InvestFundDetail, InvestFundNavHistory } from "@/features/invest/api/invest-api";
import { MfFundNavChart } from "@/features/invest/components/mf-fund-nav-chart";
import { MfNavRangeTabs } from "@/features/invest/components/mf-nav-range-tabs";
import { formatSignedReturn } from "@/features/invest/lib/mf-format";
import {
  computeNavPeriodReturn,
  filterNavPointsByRange,
  normalizeNavPoints,
  resolveNavRangeForHistory,
  type MfNavRange,
} from "@/features/invest/lib/mf-nav-history";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFundPerformanceSectionProps = {
  fund: InvestFundDetail;
  navHistory: InvestFundNavHistory | null;
  chartRange?: MfNavRange;
  onChartRangeChange?: (range: MfNavRange) => void;
};

export function MfFundPerformanceSection({
  fund,
  navHistory,
  chartRange: chartRangeProp,
  onChartRangeChange,
}: MfFundPerformanceSectionProps) {
  const [internalRange, setInternalRange] = useState<MfNavRange>("1y");
  const range = chartRangeProp ?? internalRange;
  const setRange = onChartRangeChange ?? setInternalRange;

  const allPoints = useMemo(
    () => normalizeNavPoints(navHistory?.points ?? []),
    [navHistory?.points],
  );
  const effectiveRange = useMemo(
    () => resolveNavRangeForHistory(allPoints, range),
    [allPoints, range],
  );

  useEffect(() => {
    if (effectiveRange !== range) {
      setRange(effectiveRange);
    }
  }, [effectiveRange, range, setRange]);

  const rangedPoints = useMemo(
    () => filterNavPointsByRange(allPoints, effectiveRange),
    [allPoints, effectiveRange],
  );
  const periodReturn = useMemo(
    () => computeNavPeriodReturn(rangedPoints, { range: effectiveRange, allPoints }),
    [rangedPoints, effectiveRange, allPoints],
  );
  const periodReturnDisplay = formatSignedReturn(periodReturn);
  const dayReturnDisplay = formatSignedReturn(fund.returns.return_1d);

  return (
    <section className="space-y-4" aria-label={copy.mutualFunds.performanceTitle}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MfNavRangeTabs value={effectiveRange} onChange={setRange} allPoints={allPoints} />
        <div className="flex flex-wrap items-baseline gap-2 sm:justify-end">
          <span
            className={cn(
              "text-h3 font-semibold tabular-nums",
              periodReturnDisplay.tone === "positive" && "text-success",
              periodReturnDisplay.tone === "negative" && "text-destructive",
              periodReturnDisplay.tone === "muted" && "text-foreground",
            )}
          >
            {periodReturnDisplay.text}
          </span>
          {fund.returns.return_1d != null ? (
            <span
              className={cn(
                "text-caption tabular-nums",
                dayReturnDisplay.tone === "positive" && "text-success",
                dayReturnDisplay.tone === "negative" && "text-destructive",
                dayReturnDisplay.tone === "muted" && "text-muted-foreground",
              )}
            >
              (1D {dayReturnDisplay.text})
            </span>
          ) : null}
        </div>
      </div>

      <MfFundNavChart key={effectiveRange} points={rangedPoints} periodReturn={periodReturn} />
    </section>
  );
}
