"use client";

import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InvestFundDetail, InvestFundNavHistory } from "@/features/invest/api/invest-api";
import { MfFundNavChart } from "@/features/invest/components/mf-fund-nav-chart";
import { formatSignedReturn } from "@/features/invest/lib/mf-format";
import {
  computeNavPeriodReturn,
  filterNavPointsByRange,
  MF_NAV_RANGE_OPTIONS,
  normalizeNavPoints,
  type MfNavRange,
} from "@/features/invest/lib/mf-nav-history";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function NavRangeTabs({
  value,
  onChange,
}: {
  value: MfNavRange;
  onChange: (value: MfNavRange) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={copy.mutualFunds.performanceTitle}
      className="flex flex-wrap gap-1 rounded-[var(--radius-control)] border border-border/80 bg-muted/20 p-1"
    >
      {MF_NAV_RANGE_OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "min-w-[2.75rem] rounded-[var(--radius-control)] px-3 py-1.5 text-caption font-medium transition-colors",
              active
                ? "bg-foreground text-background shadow-zynd-low"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

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
  const rangedPoints = useMemo(
    () => filterNavPointsByRange(allPoints, range),
    [allPoints, range],
  );
  const periodReturn = useMemo(() => computeNavPeriodReturn(rangedPoints), [rangedPoints]);
  const periodReturnDisplay = formatSignedReturn(periodReturn);
  const dayReturnDisplay = formatSignedReturn(fund.returns.return_1d);

  return (
    <Card className="overflow-hidden rounded-[var(--radius-medium)] border border-border">
      <CardHeader className="border-b border-border/60 bg-muted/10">
        <div className="flex items-start gap-3">
          <div className="sip-icon-badge mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
            <LineChart className="size-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <CardTitle>{copy.mutualFunds.performanceTitle}</CardTitle>
            <CardDescription>{copy.mutualFunds.performanceDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <NavRangeTabs value={range} onChange={setRange} />
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

        <MfFundNavChart
          key={range}
          points={rangedPoints}
          periodReturn={periodReturn}
        />
      </CardContent>
    </Card>
  );
}
