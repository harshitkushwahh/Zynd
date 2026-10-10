"use client";

import { Calculator, CalendarClock, IndianRupee } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioDetailLockedSection } from "@/features/dashboard/portfolio/components/portfolio-detail-locked-section";
import { formatInr } from "@/features/invest/lib/mf-format";
import { MF_FUND_DETAIL_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const DUMMY_SCENARIOS = [
  { horizon: "3m", invested: 10_000, value: 10_420, returnPct: "+4.20%" },
  { horizon: "6m", invested: 10_000, value: 10_890, returnPct: "+8.90%" },
  { horizon: "1y", invested: 10_000, value: 11_650, returnPct: "+16.50%" },
  { horizon: "3y", invested: 10_000, value: 14_280, returnPct: "+42.80%" },
  { horizon: "5y", invested: 10_000, value: 18_740, returnPct: "+87.40%" },
] as const;

const DUMMY_MAX_VALUE = 18_740;

function DummyGainBar({ invested, value }: { invested: number; value: number }) {
  const total = Math.min(100, (value / DUMMY_MAX_VALUE) * 100);
  const investedShare = (invested / value) * 100;
  return (
    <div className="h-3 w-full min-w-[5.5rem]">
      <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${total}%` }}>
        <div
          className="h-full bg-[var(--sip-invested-track)]"
          style={{ width: `${investedShare}%` }}
        />
        <div className="h-full flex-1 bg-[var(--sip-gain-track)]" />
      </div>
    </div>
  );
}

function DummyCalculatorPreview() {
  return (
    <div className="flex flex-col items-center gap-6" aria-hidden>
      <div className="relative inline-grid min-w-[15.5rem] grid-cols-2 gap-1 rounded-full border border-border/80 bg-muted/20 p-1">
        <span
          className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-foreground shadow-zynd-low"
          style={{ width: "calc((100% - 0.5rem - 0.25rem) / 2)" }}
        />
        <span className="relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-caption font-medium text-background">
          <IndianRupee className="size-3.5" strokeWidth={2.25} />
          {copy.mutualFunds.calculatorModeLumpsum}
        </span>
        <span className="relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-caption font-medium text-muted-foreground">
          <CalendarClock className="size-3.5" strokeWidth={2.25} />
          {copy.mutualFunds.calculatorModeSip}
        </span>
      </div>

      <div className="w-full max-w-md space-y-2 text-center">
        <p className="text-caption font-medium text-muted-foreground">{copy.mutualFunds.lumpsumAmountLabel}</p>
        <p className="text-h2 font-semibold tabular-nums text-foreground">
          <span className="text-h3 font-medium text-muted-foreground">₹</span> 10,000
        </p>
      </div>

      <div className="w-full max-w-lg">
        <div className="h-2 rounded-full bg-muted">
          <div className="h-full w-[18%] rounded-full bg-foreground/70" />
        </div>
        <div className="mt-2 flex justify-between text-caption text-muted-foreground">
          <span>₹100</span>
          <span>₹10.00 Cr</span>
        </div>
      </div>

      <div className={cn("w-full overflow-hidden border border-border", MF_FUND_DETAIL_RADIUS_CLASS)}>
        <table className="w-full min-w-[36rem] text-left text-compact">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-3 py-2.5 font-medium text-muted-foreground sm:px-4">
                {copy.mutualFunds.calculatorHorizonColumn}
              </th>
              <th className="px-3 py-2.5 font-medium text-muted-foreground sm:px-4">
                {copy.mutualFunds.calculatorInvestedColumn}
              </th>
              <th className="px-3 py-2.5 font-medium text-muted-foreground sm:px-4">
                {copy.mutualFunds.lumpsumChartValue}
              </th>
              <th className="w-[22%] px-3 py-2.5 font-medium text-muted-foreground sm:px-4">
                {copy.mutualFunds.calculatorHistoricReturnsColumn}
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-muted-foreground sm:px-4">
                {copy.mutualFunds.calculatorReturnColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_SCENARIOS.map((row) => (
              <tr key={row.horizon} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-3 font-medium uppercase text-muted-foreground sm:px-4">{row.horizon}</td>
                <td className="px-3 py-3 tabular-nums text-foreground sm:px-4">{formatInr(row.invested)}</td>
                <td className="px-3 py-3 font-semibold tabular-nums text-foreground sm:px-4">
                  {formatInr(row.value)}
                </td>
                <td className="px-3 py-3 sm:px-4">
                  <DummyGainBar invested={row.invested} value={row.value} />
                </td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-success sm:px-4">
                  {row.returnPct}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MfNfoCalculatorDisabled() {
  return (
    <Card className={cn("overflow-hidden border border-border", MF_FUND_DETAIL_RADIUS_CLASS)}>
      <CardHeader className="border-b border-border/60 bg-muted/10">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <Calculator className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle>{copy.mutualFunds.fundCalculatorTitle}</CardTitle>
            <CardDescription>{copy.mutualFunds.fundCalculatorDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-4">
        <PortfolioDetailLockedSection
          stacked
          title={copy.mutualFunds.nfoCalculatorDisabledTitle}
          subtitle={copy.mutualFunds.nfoCalculatorDisabledBody}
        >
          <DummyCalculatorPreview />
        </PortfolioDetailLockedSection>
      </CardContent>
    </Card>
  );
}
