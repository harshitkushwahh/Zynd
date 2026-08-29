"use client";

import { useState } from "react";

import { OverviewPortfolioFlowChart } from "@/features/dashboard/overview/components/overview-portfolio-flow-chart";
import {
  type OverviewPortfolioFlowPoint,
  type OverviewPortfolioFlowRange,
} from "@/features/dashboard/overview/lib/overview-portfolio-flow-series";
import type { OverviewPortfolioPreview } from "@/features/dashboard/overview/lib/overview-portfolio-preview";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import {
  MfReturnDirectionBadge,
  mfReturnToneTextClass,
} from "@/features/invest/lib/mf-return-tone-styles";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type PortfolioSummaryCardProps = {
  data: OverviewPortfolioPreview;
  series: readonly OverviewPortfolioFlowPoint[];
  showDayChange?: boolean;
  className?: string;
};

export function PortfolioSummaryCard({
  data,
  series,
  showDayChange = true,
  className,
}: PortfolioSummaryCardProps) {
  const overview = copy.dashboard.overview;
  const totalReturn = formatSignedReturn(data.totalReturnPct);
  const dayChange = formatSignedReturn(data.dayChangePct);
  const [range, setRange] = useState<OverviewPortfolioFlowRange>("1y");

  return (
    <section
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "flex min-h-[13.5rem] min-w-0 flex-col overflow-hidden border border-border/60 bg-card",
        className,
      )}
    >
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">{overview.portfolioCurrentValue}</p>
            <p className="mt-1 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-foreground sm:text-[2rem]">
              {formatInr(data.currentValueInr)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className={cn("text-compact font-semibold tabular-nums", mfReturnToneTextClass(totalReturn.tone))}
            >
              {totalReturn.text}
            </span>
            <MfReturnDirectionBadge tone={totalReturn.tone} />
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-caption">
          <span className={cn("font-semibold tabular-nums", mfReturnToneTextClass(totalReturn.tone))}>
            {formatInr(data.totalReturnInr)} ({totalReturn.text})
          </span>
          {showDayChange ? (
            <>
              <span className="text-muted-foreground">·</span>
              <span className={cn("font-medium tabular-nums", mfReturnToneTextClass(dayChange.tone))}>
                {dayChange.text} today · {formatInr(data.dayChangeInr)}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-auto px-1 pt-3 sm:px-2">
        <OverviewPortfolioFlowChart
          series={[...series]}
          range={range}
          onRangeChange={setRange}
        />
      </div>
    </section>
  );
}
