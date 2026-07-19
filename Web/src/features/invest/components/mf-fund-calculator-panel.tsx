"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, IndianRupee, Loader2, type LucideIcon } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import type { InvestFundDetail, InvestReturnCalculator } from "@/features/invest/api/invest-api";
import { MfCalculatorDisclaimer } from "@/features/invest/components/mf-calculator-disclaimer";
import {
  fetchLumpsumCalculatorWithFallback,
  fetchSipHorizonsCalculatorWithFallback,
} from "@/features/invest/lib/mf-calculator-api";
import { formatDate, formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import {
  clampLumpsumAmount,
  LUMPSUM_CALCULATOR_DEFAULT_AMOUNT,
  LUMPSUM_CALCULATOR_MAX_AMOUNT,
  lumpsumAmountStep,
  resolveMinLumpsumAmount,
} from "@/features/invest/lib/mf-lumpsum-calculator";
import {
  clampSipAmount,
  SIP_CALCULATOR_DEFAULT_MIN_AMOUNT,
  SIP_CALCULATOR_MAX_AMOUNT,
  resolveMinSipAmount,
  sipAmountStep,
} from "@/features/invest/lib/mf-sip-calculator";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type CalculatorMode = "lumpsum" | "sip";

type MfFundCalculatorPanelProps = {
  fund: InvestFundDetail;
  initialCalculator?: InvestReturnCalculator | null;
};

function ModeTabs({
  mode,
  onChange,
}: {
  mode: CalculatorMode;
  onChange: (mode: CalculatorMode) => void;
}) {
  const options: Array<{ id: CalculatorMode; label: string; icon: LucideIcon }> = [
    { id: "lumpsum", label: copy.mutualFunds.calculatorModeLumpsum, icon: IndianRupee },
    { id: "sip", label: copy.mutualFunds.calculatorModeSip, icon: CalendarClock },
  ];

  return (
    <div
      role="tablist"
      aria-label={copy.mutualFunds.performanceCalculatorTab}
      className="inline-flex rounded-[var(--radius-control)] border border-border/80 bg-muted/20 p-1"
    >
      {options.map((option) => {
        const active = mode === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-[var(--radius-control)] px-4 py-1.5 text-caption font-medium transition-colors",
              active
                ? "bg-foreground text-background shadow-zynd-low"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {active ? <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden /> : null}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function normalizeSliderValue(value: number | readonly number[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function MfFundCalculatorPanel({ fund, initialCalculator }: MfFundCalculatorPanelProps) {
  const [mode, setMode] = useState<CalculatorMode>("lumpsum");
  const [amount, setAmount] = useState(LUMPSUM_CALCULATOR_DEFAULT_AMOUNT);
  const [calculator, setCalculator] = useState<InvestReturnCalculator | null>(initialCalculator ?? null);
  const [loading, setLoading] = useState(false);
  const previousMode = useRef(mode);

  const minLumpsum = useMemo(
    () => resolveMinLumpsumAmount(fund.min_lumpsum_amount_inr),
    [fund.min_lumpsum_amount_inr],
  );
  const minSip = useMemo(() => resolveMinSipAmount(fund.min_sip_amount_inr), [fund.min_sip_amount_inr]);

  const minAmount = mode === "lumpsum" ? minLumpsum : minSip;
  const maxAmount = mode === "lumpsum" ? LUMPSUM_CALCULATOR_MAX_AMOUNT : SIP_CALCULATOR_MAX_AMOUNT;
  const amountStep = useMemo(
    () =>
      mode === "lumpsum"
        ? lumpsumAmountStep(fund.min_lumpsum_amount_inr, amount)
        : sipAmountStep(fund.min_sip_amount_inr),
    [amount, fund.min_lumpsum_amount_inr, fund.min_sip_amount_inr, mode],
  );

  const amountLabel =
    mode === "lumpsum" ? copy.mutualFunds.lumpsumAmountLabel : copy.mutualFunds.sipMonthlyLabel;

  useEffect(() => {
    if (previousMode.current !== mode) {
      setCalculator(null);
      previousMode.current = mode;
    }
    setAmount((current) =>
      mode === "lumpsum"
        ? clampLumpsumAmount(current, fund.min_lumpsum_amount_inr)
        : clampSipAmount(current || SIP_CALCULATOR_DEFAULT_MIN_AMOUNT, fund.min_sip_amount_inr),
    );
  }, [fund.min_lumpsum_amount_inr, fund.min_sip_amount_inr, mode]);

  useEffect(() => {
    if (amount <= 0) return;

    let cancelled = false;
    setLoading(true);

    const timeout = window.setTimeout(() => {
      const request =
        mode === "lumpsum"
          ? fetchLumpsumCalculatorWithFallback(fund.product_id, { amount_inr: amount }).then((response) => ({
              product_id: response.product_id,
              amount_inr: response.amount_inr,
              mode: response.mode,
              as_of_date: response.as_of_date,
              data_quality: response.data_quality,
              disclaimer: response.disclaimer,
              scenarios: response.scenarios,
            }))
          : fetchSipHorizonsCalculatorWithFallback(fund.product_id, amount);

      request
        .then((response) => {
          if (!cancelled) setCalculator(response);
        })
        .catch(() => {
          if (!cancelled) setCalculator(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [amount, fund.product_id, mode]);

  function handleAmountInput(rawValue: string) {
    const parsed = Number(rawValue.replace(/[^\d]/g, ""));
    if (!Number.isFinite(parsed)) {
      setAmount(minAmount);
      return;
    }
    setAmount(
      mode === "lumpsum"
        ? clampLumpsumAmount(parsed, fund.min_lumpsum_amount_inr)
        : clampSipAmount(parsed, fund.min_sip_amount_inr),
    );
  }

  function handleSliderChange(nextValue: number | readonly number[]) {
    const resolved = normalizeSliderValue(nextValue);
    if (resolved == null || !Number.isFinite(resolved)) return;
    setAmount(
      mode === "lumpsum"
        ? clampLumpsumAmount(resolved, fund.min_lumpsum_amount_inr)
        : clampSipAmount(resolved, fund.min_sip_amount_inr),
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <ModeTabs mode={mode} onChange={setMode} />

      <div className="w-full max-w-md space-y-2 text-center">
        <p className="text-caption font-medium text-muted-foreground">{amountLabel}</p>
        <div className="flex items-center justify-center gap-1">
          <span className="text-h3 font-medium text-muted-foreground">₹</span>
          <input
            id="fund-detail-calc-amount"
            type="text"
            inputMode="numeric"
            aria-label={amountLabel}
            value={amount.toLocaleString("en-IN")}
            onChange={(event) => handleAmountInput(event.target.value)}
            className="w-full max-w-[16rem] border-0 bg-transparent text-center text-h2 font-semibold tabular-nums text-foreground shadow-none outline-none focus-visible:ring-0"
          />
        </div>
        {mode === "lumpsum" && fund.min_lumpsum_amount_inr != null ? (
          <p className="text-caption text-muted-foreground">
            {copy.mutualFunds.lumpsumFundMinNote.replace("{amount}", formatInr(fund.min_lumpsum_amount_inr))}
          </p>
        ) : null}
        {mode === "sip" && fund.min_sip_amount_inr != null ? (
          <p className="text-caption text-muted-foreground">
            {copy.mutualFunds.sipFundMinNote.replace("{amount}", formatInr(fund.min_sip_amount_inr))}
          </p>
        ) : null}
      </div>

      <div className="w-full max-w-lg">
        <div className="py-1 [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-track]]:h-2">
          <Slider
            id="fund-detail-calc-slider"
            value={amount}
            min={minAmount}
            max={maxAmount}
            step={amountStep}
            onValueChange={handleSliderChange}
          />
        </div>
        <div className="mt-2 flex justify-between text-caption text-muted-foreground">
          <span>{formatInr(minAmount)}</span>
          <span>{formatInr(maxAmount, { compact: true })}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {copy.mutualFunds.calculatorLoading}
        </div>
      ) : null}

      {!loading && calculator && calculator.scenarios.length > 0 ? (
        <div className="w-full space-y-4">
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
            <table className="w-full text-left text-compact">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">
                    {copy.mutualFunds.calculatorHorizonColumn}
                  </th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">
                    {copy.mutualFunds.lumpsumChartValue}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                    {copy.mutualFunds.calculatorReturnColumn}
                  </th>
                </tr>
              </thead>
              <tbody>
                {calculator.scenarios.map((scenario) => {
                  const returnDisplay = formatSignedReturn(scenario.return_pct);
                  return (
                    <tr key={scenario.horizon} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-medium uppercase text-muted-foreground">
                        {scenario.horizon}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        {formatInr(scenario.value_inr)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-medium tabular-nums",
                          returnDisplay.tone === "positive" && "text-success",
                          returnDisplay.tone === "negative" && "text-destructive",
                          returnDisplay.tone === "muted" && "text-muted-foreground",
                        )}
                      >
                        {returnDisplay.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-center text-caption text-muted-foreground">
            {copy.mutualFunds.lumpsumHorizonsNote}
            {calculator.as_of_date ? ` · ${formatDate(calculator.as_of_date)}` : ""}
          </p>

          {calculator.disclaimer ? (
            <MfCalculatorDisclaimer
              disclaimer={calculator.disclaimer}
              dataQuality={calculator.data_quality}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
