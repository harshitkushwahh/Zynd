"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

import { RechartsMeasuredContainer } from "@/components/ui/recharts-measured-container";

import {
  MF_CALC_GAIN_DOT_CLASS,
  MF_CALC_GAIN_TEXT_CLASS,
  MF_CALC_INVESTED_DOT_CLASS,
} from "@/features/invest/lib/mf-calculator-ui";
import { formatInr, formatReturn } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type CorpusSlice = {
  id: "invested" | "gain";
  label: string;
  value: number;
  fill: string;
};

type LumpsumCorpusDonutProps = {
  invested: number;
  projectedValue: number;
  horizonLabel?: string;
  returnPct?: number | null;
  showLegend?: boolean;
  className?: string;
};

type DonutTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CorpusSlice }>;
};

function DonutTooltip({ active, payload }: DonutTooltipProps) {
  if (!active || !payload?.length) return null;
  const slice = payload[0]?.payload;
  if (!slice) return null;

  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-popover px-3 py-2 shadow-zynd-mid">
      <p className="text-caption text-muted-foreground">{slice.label}</p>
      <p className="text-compact font-semibold tabular-nums text-foreground">{formatInr(slice.value)}</p>
    </div>
  );
}

export function LumpsumCorpusDonut({
  invested,
  projectedValue,
  horizonLabel,
  returnPct = null,
  showLegend = true,
  className,
}: LumpsumCorpusDonutProps) {
  const gain = Math.max(0, projectedValue - invested);
  const slices = useMemo<CorpusSlice[]>(
    () => [
      {
        id: "invested",
        label: copy.mutualFunds.lumpsumChartInvested,
        value: invested,
        fill: "var(--sip-invested-track)",
      },
      {
        id: "gain",
        label: copy.mutualFunds.lumpsumChartGain,
        value: gain,
        fill: "var(--sip-gain-track)",
      },
    ],
    [gain, invested],
  );

  const chartData = gain > 0 ? slices : [slices[0]];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative mx-auto size-[11.5rem] sm:size-[12.5rem]">
        <RechartsMeasuredContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={gain > 0 ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {chartData.map((slice) => (
                <Cell key={slice.id} fill={slice.fill} />
              ))}
            </Pie>
            <Tooltip content={(props) => <DonutTooltip {...(props as DonutTooltipProps)} />} />
          </PieChart>
        </RechartsMeasuredContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          {horizonLabel ? (
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {horizonLabel}
            </p>
          ) : null}
          <p
            className={cn(
              "text-body font-semibold tabular-nums tracking-tight",
              returnPct != null && returnPct > 0 ? MF_CALC_GAIN_TEXT_CLASS : "text-foreground",
            )}
          >
            {returnPct != null ? formatReturn(returnPct) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">{copy.mutualFunds.lumpsumChartTitle}</p>
        </div>
      </div>

      {showLegend ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className={MF_CALC_INVESTED_DOT_CLASS} />
            {copy.mutualFunds.lumpsumChartInvested}: {formatInr(invested)}
          </span>
          <span className={cn("inline-flex items-center gap-1.5", MF_CALC_GAIN_TEXT_CLASS)}>
            <span className={MF_CALC_GAIN_DOT_CLASS} />
            {copy.mutualFunds.lumpsumChartGain}: {formatInr(gain)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
