"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PAGE_HEADER_ICON_CLASS } from "@/components/ui/page-header";
import { Slider } from "@/components/ui/slider";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  fetchInvestFundDetail,
  type InvestFundSummary,
  type MfSipCalculator,
} from "@/features/invest/api/invest-api";
import { fetchSipCalculatorWithFallback } from "@/features/invest/lib/mf-calculator-api";
import { MfCalculatorDisclaimer } from "@/features/invest/components/mf-calculator-disclaimer";
import { MfFundPicker } from "@/features/invest/components/mf-fund-picker";
import { MfGrowthProjectionHeader } from "@/features/invest/components/mf-growth-projection-header";
import { MfSipDayPicker } from "@/features/invest/components/mf-sip-day-picker";
import { MfSipProjectionChartPanel } from "@/features/invest/components/mf-sip-projection-chart";
import { MfSipCalculatorResultsSkeleton } from "@/features/invest/components/mf-tools-page-skeleton";
import { MfToolsPageShell } from "@/features/invest/components/mf-tools-page-shell";
import { MF_TOOL_ICONS } from "@/features/invest/lib/mf-dashboard-sidebar-data";
import { formatDate, formatInr, formatReturn } from "@/features/invest/lib/mf-format";
import {
  clampInstallments,
  clampSipAmount,
  formatInstallmentDuration,
  resolveMinSipAmount,
  SIP_CALCULATOR_DEFAULT_DAY,
  SIP_CALCULATOR_DEFAULT_INSTALLMENTS,
  SIP_CALCULATOR_MAX_AMOUNT,
  SIP_CALCULATOR_MAX_INSTALLMENTS,
  SIP_CALCULATOR_MIN_INSTALLMENTS,
  SIP_PLACEHOLDER_PROJECTION_POINTS,
  sipAmountStep,
} from "@/features/invest/lib/mf-sip-calculator";
import {
  MF_SIP_CARD_CLASS,
  MF_SIP_CARD_CONTENT_CLASS,
  MF_SIP_GAIN_BAR_CLASS,
  MF_SIP_GAIN_DOT_CLASS,
  MF_SIP_GAIN_TEXT_CLASS,
  MF_SIP_HERO_CLASS,
  MF_SIP_ICON_BADGE_CLASS,
  MF_SIP_INVESTED_BAR_CLASS,
  MF_SIP_INVESTED_DOT_CLASS,
  MF_SIP_PANEL_CLASS,
  MF_SIP_STAT_CLASS,
} from "@/features/invest/lib/mf-sip-calculator-ui";
import { copy } from "@/shared/config/copy";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

type SipSliderFieldProps = {
  id: string;
  label: string;
  valueLabel: string;
  hint?: string;
  minLabel: string;
  maxLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
};

function normalizeSliderValue(value: number | readonly number[]) {
  return Array.isArray(value) ? value[0] : value;
}

function SipSliderField({
  id,
  label,
  valueLabel,
  hint,
  minLabel,
  maxLabel,
  value,
  min,
  max,
  step,
  onValueChange,
  disabled = false,
  prominentValue = false,
}: SipSliderFieldProps & { prominentValue?: boolean }) {
  return (
    <div className={MF_SIP_PANEL_CLASS}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label className="text-caption font-medium text-foreground" htmlFor={id}>
            {label}
          </label>
          {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        <p
          className={cn(
            "shrink-0 text-right font-semibold tabular-nums text-foreground",
            prominentValue ? "text-compact" : "text-caption",
          )}
        >
          {valueLabel}
        </p>
      </div>
      <div className="mt-2.5 py-1 [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:h-1.5">
        <Slider
          id={id}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={(nextValue) => {
            const resolved = normalizeSliderValue(nextValue);
            if (resolved == null || !Number.isFinite(resolved)) return;
            onValueChange(Math.min(max, Math.max(min, resolved)));
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

type SipCorpusBreakdownProps = {
  totalInvested: number;
  projectedValue: number;
};

function SipCorpusBreakdown({ totalInvested, projectedValue }: SipCorpusBreakdownProps) {
  const investedShare = projectedValue > 0 ? Math.min(100, (totalInvested / projectedValue) * 100) : 100;
  const gains = Math.max(0, projectedValue - totalInvested);
  const gainPct = (gains / Math.max(totalInvested, 1)) * 100;

  return (
    <div className={MF_SIP_PANEL_CLASS}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption font-medium text-foreground">{copy.mutualFunds.sipCorpusBreakdown}</p>
        <p className={cn("text-caption font-semibold tabular-nums", gainPct > 0 && MF_SIP_GAIN_TEXT_CLASS)}>
          {formatReturn(gainPct)}
        </p>
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 transition-[width] duration-300", MF_SIP_INVESTED_BAR_CLASS)}
          style={{ width: `${investedShare}%` }}
        />
        <div
          className={cn("absolute inset-y-0 transition-[width] duration-300", MF_SIP_GAIN_BAR_CLASS)}
          style={{ left: `${investedShare}%`, width: `${Math.max(0, 100 - investedShare)}%` }}
        />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className={MF_SIP_INVESTED_DOT_CLASS} />
          {copy.mutualFunds.sipTotalInvested}: {formatInr(totalInvested)}
        </span>
        <span className={cn("inline-flex items-center gap-1.5", MF_SIP_GAIN_TEXT_CLASS)}>
          <span className={MF_SIP_GAIN_DOT_CLASS} />
          {copy.mutualFunds.sipChartGain}: {formatInr(gains)}
        </span>
      </div>
    </div>
  );
}

type SipMetricTileProps = {
  label: string;
  value: string;
  accent?: boolean;
};

function SipMetricTile({ label, value, accent = false }: SipMetricTileProps) {
  return (
    <div className={MF_SIP_PANEL_CLASS}>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-body font-semibold tabular-nums tracking-tight", accent && MF_SIP_GAIN_TEXT_CLASS)}>
        {value}
      </p>
    </div>
  );
}

type SipStatChipProps = {
  label: string;
  value: string;
};

function SipStatChip({ label, value }: SipStatChipProps) {
  return (
    <div className={MF_SIP_STAT_CLASS}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-compact font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

type SipResultsCardProps = {
  result: MfSipCalculator;
  projectedGain: number;
};

function SipResultsCard({ result, projectedGain }: SipResultsCardProps) {
  return (
    <Card className={cn("h-full", MF_SIP_CARD_CLASS)}>
      <CardContent className={cn("h-full", MF_SIP_CARD_CONTENT_CLASS)}>
        <div className="flex items-center gap-2.5 text-body font-semibold tracking-tight">
          <span className={MF_SIP_ICON_BADGE_CLASS}>
            <TrendingUp className="size-4" strokeWidth={2.25} />
          </span>
          {copy.mutualFunds.sipResultsTitle}
        </div>

        <div className={MF_SIP_HERO_CLASS}>
          <p className="text-caption text-muted-foreground">{copy.mutualFunds.sipProjectedValue}</p>
          <p className="mt-1 text-h2 font-semibold tracking-tight text-foreground">
            {formatInr(result.projected_value_inr)}
          </p>
          {result.as_of_date ? (
            <p className="mt-1 text-caption text-muted-foreground">{formatDate(result.as_of_date)}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SipMetricTile label={copy.mutualFunds.sipTotalInvested} value={formatInr(result.total_invested_inr)} />
          <SipMetricTile
            label={copy.mutualFunds.sipChartGain}
            value={formatInr(projectedGain)}
            accent={projectedGain > 0}
          />
        </div>

        <SipCorpusBreakdown totalInvested={result.total_invested_inr} projectedValue={result.projected_value_inr} />

        <div className="grid grid-cols-3 gap-2">
          <SipStatChip label={copy.mutualFunds.returnsTitle} value={formatReturn(result.return_pct)} />
          <SipStatChip label={copy.mutualFunds.sipXirr} value={formatReturn(result.xirr_pct)} />
          <SipStatChip label={copy.mutualFunds.sipInstallmentsLabel} value={String(result.installments)} />
        </div>
      </CardContent>
    </Card>
  );
}

export function MfSipCalculatorView() {
  const searchParams = useSearchParams();
  const [fund, setFund] = useState<InvestFundSummary | null>(null);
  const [monthlyAmount, setMonthlyAmount] = useState(5_000);
  const [installments, setInstallments] = useState(SIP_CALCULATOR_DEFAULT_INSTALLMENTS);
  const [sipDay, setSipDay] = useState(SIP_CALCULATOR_DEFAULT_DAY);
  const [result, setResult] = useState<MfSipCalculator | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minSipAmount = useMemo(() => resolveMinSipAmount(fund?.min_sip_amount_inr), [fund?.min_sip_amount_inr]);
  const amountStep = useMemo(() => sipAmountStep(fund?.min_sip_amount_inr), [fund?.min_sip_amount_inr]);

  useEffect(() => {
    const productId = searchParams.get("fund");
    if (!productId) return;

    let cancelled = false;
    fetchInvestFundDetail(productId)
      .then((detail) => {
        if (!cancelled) setFund(detail);
      })
      .catch(() => {
        if (!cancelled) setFund(null);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    setMonthlyAmount((current) => clampSipAmount(current, fund?.min_sip_amount_inr));
  }, [fund?.min_sip_amount_inr]);

  useEffect(() => {
    if (!fund?.product_id || monthlyAmount <= 0 || installments <= 0) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timeout = window.setTimeout(() => {
      fetchSipCalculatorWithFallback(fund.product_id, {
        monthly_amount_inr: monthlyAmount,
        duration_months: installments,
        sip_day: sipDay,
      })
        .then((response) => {
          if (!cancelled) setResult(response);
        })
        .catch((err: Error) => {
          if (!cancelled) {
            setResult(null);
            setError(err.message || copy.mutualFunds.calculatorLoadError);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [fund?.product_id, installments, monthlyAmount, sipDay]);

  const hasResult = Boolean(!loading && result && result.installments > 0);
  const projectedGain = hasResult
    ? Math.max(0, (result?.projected_value_inr ?? 0) - (result?.total_invested_inr ?? 0))
    : 0;

  return (
    <MfToolsPageShell
      trail={[{ label: copy.mutualFunds.sipCalcTitle, href: "/dashboard/mutual-funds/calculators/sip" }]}
      title={copy.mutualFunds.sipCalcTitle}
      icon={MF_TOOL_ICONS["sip-calc"]}
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card className={cn("h-full", MF_SIP_CARD_CLASS)}>
          <CardContent className={MF_SIP_CARD_CONTENT_CLASS}>
            <div className="flex items-center gap-2.5 text-body font-semibold tracking-tight">
              <CalendarClock
                className={cn("size-5 shrink-0", PAGE_HEADER_ICON_CLASS)}
                strokeWidth={2.25}
              />
              {copy.mutualFunds.sipInputsTitle}
            </div>

            <div className="space-y-2">
              <MfFundPicker value={fund} onChange={setFund} />
              {fund?.min_sip_amount_inr != null ? (
                <p className="text-caption text-muted-foreground">
                  {copy.mutualFunds.sipFundMinNote.replace("{amount}", formatInr(fund.min_sip_amount_inr))}
                </p>
              ) : null}
            </div>

            <SipSliderField
              id="sip-monthly"
              label={copy.mutualFunds.sipMonthlyLabel}
              valueLabel={formatInr(monthlyAmount)}
              prominentValue
              minLabel={formatInr(minSipAmount)}
              maxLabel={formatInr(SIP_CALCULATOR_MAX_AMOUNT)}
              value={monthlyAmount}
              min={minSipAmount}
              max={SIP_CALCULATOR_MAX_AMOUNT}
              step={amountStep}
              disabled={!fund}
              onValueChange={(nextAmount) => {
                setMonthlyAmount(clampSipAmount(nextAmount, fund?.min_sip_amount_inr));
              }}
            />

            <SipSliderField
              id="sip-installments"
              label={copy.mutualFunds.sipInstallmentsLabel}
              valueLabel={formatInstallmentDuration(installments)}
              minLabel={String(SIP_CALCULATOR_MIN_INSTALLMENTS)}
              maxLabel={String(SIP_CALCULATOR_MAX_INSTALLMENTS)}
              value={installments}
              min={SIP_CALCULATOR_MIN_INSTALLMENTS}
              max={SIP_CALCULATOR_MAX_INSTALLMENTS}
              step={1}
              disabled={!fund}
              onValueChange={(nextInstallments) => {
                setInstallments(clampInstallments(nextInstallments));
              }}
            />

            <div className={MF_SIP_PANEL_CLASS}>
              <MfSipDayPicker value={sipDay} onChange={setSipDay} disabled={!fund} compact />
            </div>
          </CardContent>
        </Card>

        <div className="flex h-full min-h-0 flex-col gap-4">
          {!fund ? (
            <Card className={cn("h-full flex-1 border border-dashed border-border bg-transparent py-0 shadow-none ring-0 [--card-spacing:0]", ZYND_3XL_RADIUS_CLASS)}>
              <CardContent className="flex h-full min-h-full flex-col items-center justify-center gap-3 p-5 text-center sm:p-6">
                <TrendingUp className="size-8 text-[var(--sip-empty-icon)]" />
                <div>
                  <p className="text-compact font-medium text-foreground">{copy.mutualFunds.sipSelectFundPrompt}</p>
                  <p className="mt-1 max-w-md text-caption text-muted-foreground">
                    {copy.mutualFunds.sipSelectFundPromptDescription}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {fund && error ? <FieldMessage variant="error" message={error} /> : null}

          {fund && loading ? <MfSipCalculatorResultsSkeleton /> : null}

          {fund && hasResult && result ? <SipResultsCard result={result} projectedGain={projectedGain} /> : null}
        </div>
        </div>

        <Card className={cn("w-full", MF_SIP_CARD_CLASS)}>
          <CardContent className={cn(MF_SIP_CARD_CONTENT_CLASS, "gap-4")}>
            <MfGrowthProjectionHeader
              title={copy.mutualFunds.sipChartTitle}
              description={copy.mutualFunds.sipChartDescription}
            />

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className={MF_SIP_INVESTED_DOT_CLASS} aria-hidden />
                {copy.mutualFunds.sipChartInvested}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={MF_SIP_GAIN_DOT_CLASS} aria-hidden />
                {copy.mutualFunds.sipChartGain}
              </span>
            </div>

            <MfSipProjectionChartPanel
              points={
                fund && hasResult && result ? result.points : SIP_PLACEHOLDER_PROJECTION_POINTS
              }
              locked={!fund}
              loading={Boolean(fund && loading)}
              emptyMessage={copy.mutualFunds.sipChartEmpty}
              disclaimer={
                fund && hasResult && result ? (
                  <MfCalculatorDisclaimer
                    disclaimer={result.disclaimer}
                    dataQuality={result.data_quality}
                  />
                ) : null
              }
            />
          </CardContent>
        </Card>
      </div>
    </MfToolsPageShell>
  );
}
