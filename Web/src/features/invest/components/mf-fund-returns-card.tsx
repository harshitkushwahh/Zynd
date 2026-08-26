"use client";

import { TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvestFundDetail, InvestNavPoint } from "@/features/invest/api/invest-api";
import { formatSignedReturn } from "@/features/invest/lib/mf-format";
import {
  hasSufficientNavHistoryForRange,
  normalizeNavPoints,
  type MfNavRange,
} from "@/features/invest/lib/mf-nav-history";
import { MF_FUND_DETAIL_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ReturnRow = {
  key: keyof InvestFundDetail["returns"];
  label: string;
  range?: MfNavRange;
};

const SHORT_RETURN_ROWS: ReturnRow[] = [
  { key: "return_1d", label: "1D" },
  { key: "return_1w", label: "1W" },
];

const LEFT_RETURN_ROWS: ReturnRow[] = [
  { key: "return_1m", label: "1M", range: "1m" },
  { key: "return_3m", label: "3M", range: "3m" },
  { key: "return_6m", label: "6M", range: "6m" },
];

const RIGHT_RETURN_ROWS: ReturnRow[] = [
  { key: "return_1y", label: "1Y", range: "1y" },
  { key: "return_3y", label: "3Y CAGR", range: "3y" },
  { key: "return_5y", label: "5Y CAGR" },
];

type MfFundReturnsCardProps = {
  returns: InvestFundDetail["returns"];
  selectedRange?: MfNavRange;
  onRangeSelect?: (range: MfNavRange) => void;
  navPoints?: InvestNavPoint[];
};

function ReturnCell({
  label,
  value,
  range,
  highlighted,
  onRangeSelect,
  rangeAvailable = true,
}: {
  label: string;
  value: number | null | undefined;
  range?: MfNavRange;
  highlighted: boolean;
  onRangeSelect?: (range: MfNavRange) => void;
  rangeAvailable?: boolean;
}) {
  const display = formatSignedReturn(value);
  const interactive = Boolean(range && onRangeSelect && rangeAvailable);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive && range ? () => onRangeSelect?.(range) : undefined}
      onKeyDown={
        interactive && range
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onRangeSelect?.(range);
              }
            }
          : undefined
      }
      className={cn(
        "flex cursor-default items-center justify-between gap-3 px-4 py-3",
        interactive && "cursor-pointer transition-colors hover:bg-muted/30",
        highlighted && "bg-primary/5",
      )}
    >
      <span className="font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          display.tone === "positive" && "text-success",
          display.tone === "negative" && "text-destructive",
          display.tone === "muted" && "text-muted-foreground",
        )}
      >
        {display.text}
      </span>
    </div>
  );
}

function ReturnColumn({
  rows,
  returns,
  selectedRange,
  onRangeSelect,
  navChartPoints,
}: {
  rows: ReturnRow[];
  returns: InvestFundDetail["returns"];
  selectedRange?: MfNavRange;
  onRangeSelect?: (range: MfNavRange) => void;
  navChartPoints: ReturnType<typeof normalizeNavPoints>;
}) {
  return (
    <div className="divide-y divide-border/60">
      {rows.map(({ key, label, range }) => (
        <ReturnCell
          key={key}
          label={label}
          value={returns[key]}
          range={range}
          rangeAvailable={range ? hasSufficientNavHistoryForRange(navChartPoints, range) : false}
          highlighted={range != null && range === selectedRange}
          onRangeSelect={onRangeSelect}
        />
      ))}
    </div>
  );
}

export function MfFundReturnsCard({
  returns,
  selectedRange,
  onRangeSelect,
  navPoints = [],
}: MfFundReturnsCardProps) {
  const navChartPoints = normalizeNavPoints(navPoints);

  return (
    <Card className={cn("overflow-hidden border border-border", MF_FUND_DETAIL_RADIUS_CLASS)}>
      <CardHeader className="border-b border-border/60 bg-muted/10">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <TrendingUp className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle>{copy.mutualFunds.returnsTitle}</CardTitle>
            <CardDescription>{copy.mutualFunds.returnsDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid divide-x divide-border/60 border-b border-border/60 sm:grid-cols-2">
          {SHORT_RETURN_ROWS.map(({ key, label }) => (
            <ReturnCell
              key={key}
              label={label}
              value={returns[key]}
              highlighted={false}
            />
          ))}
        </div>
        <div className="grid divide-x divide-border/60 sm:grid-cols-2">
          <ReturnColumn
            rows={LEFT_RETURN_ROWS}
            returns={returns}
            selectedRange={selectedRange}
            onRangeSelect={onRangeSelect}
            navChartPoints={navChartPoints}
          />
          <ReturnColumn
            rows={RIGHT_RETURN_ROWS}
            returns={returns}
            selectedRange={selectedRange}
            onRangeSelect={onRangeSelect}
            navChartPoints={navChartPoints}
          />
        </div>
      </CardContent>
    </Card>
  );
}
