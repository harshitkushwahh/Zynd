"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LineChart, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { PAGE_HEADER_ICON_CLASS } from "@/components/ui/page-header";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  fetchInvestFundDetail,
  type InvestFundSummary,
  type InvestReturnCalculatorScenario,
  type MfLumpsumCalculator,
} from "@/features/invest/api/invest-api";
import { fetchLumpsumCalculatorWithFallback } from "@/features/invest/lib/mf-calculator-api";
import { MfCalculatorProjectionChartPanel } from "@/features/invest/components/mf-calculator-projection-chart";
import { MfCalculatorDisclaimer } from "@/features/invest/components/mf-calculator-disclaimer";
import { MfCalculatorSliderField } from "@/features/invest/components/mf-calculator-slider-field";
import { LumpsumCorpusDonut } from "@/features/invest/components/mf-lumpsum-corpus-donut";
import { MfFundPicker } from "@/features/invest/components/mf-fund-picker";
import { MfGrowthProjectionHeader } from "@/features/invest/components/mf-growth-projection-header";
import { MfLumpsumCalculatorResultsSkeleton } from "@/features/invest/components/mf-tools-page-skeleton";
import { MfToolsPageShell } from "@/features/invest/components/mf-tools-page-shell";
import { MF_TOOL_ICONS } from "@/features/invest/lib/mf-dashboard-sidebar-data";
import {
  MF_CALC_CARD_CLASS,
  MF_CALC_CARD_CONTENT_CLASS,
  MF_CALC_GAIN_BAR_CLASS,
  MF_CALC_GAIN_DOT_CLASS,
  MF_CALC_GAIN_TEXT_CLASS,
  MF_CALC_ICON_BADGE_CLASS,
  MF_CALC_INVESTED_BAR_CLASS,
  MF_CALC_INVESTED_DOT_CLASS,
  MF_CALC_PANEL_CLASS,
} from "@/features/invest/lib/mf-calculator-ui";
import { formatDate, formatInr } from "@/features/invest/lib/mf-format";
import {
  clampLumpsumAmount,
  LUMPSUM_CALCULATOR_DEFAULT_AMOUNT,
  LUMPSUM_CALCULATOR_MAX_AMOUNT,
  LUMPSUM_PLACEHOLDER_CHART_SERIES,
  calculatorPointsToSeries,
  lumpsumAmountStep,
  resolveMinLumpsumAmount,
  scenariosToChartSeries,
} from "@/features/invest/lib/mf-lumpsum-calculator";
import { copy } from "@/shared/config/copy";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

function findBestScenario(scenarios: InvestReturnCalculatorScenario[]) {
  return scenarios.reduce<InvestReturnCalculatorScenario | null>((best, scenario) => {
    if (scenario.return_pct == null) return best;
    if (!best || best.return_pct == null || scenario.return_pct > best.return_pct) {
      return scenario;
    }
    return best;
  }, null);
}

type LumpsumCorpusProgressProps = {
  invested: number;
  projectedValue: number;
};

function LumpsumCorpusProgress({ invested, projectedValue }: LumpsumCorpusProgressProps) {
  const gains = Math.max(0, projectedValue - invested);
  const investedShare =
    projectedValue > 0 ? Math.min(100, (invested / projectedValue) * 100) : 100;
  const gainShare = Math.max(0, 100 - investedShare);

  return (
    <div className={cn(MF_CALC_PANEL_CLASS, "mt-4")}>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("absolute inset-y-0 left-0 transition-[width] duration-300", MF_CALC_INVESTED_BAR_CLASS)}
          style={{ width: `${investedShare}%` }}
        />
        {gainShare > 0 ? (
          <div
            className={cn("absolute inset-y-0 transition-[width] duration-300", MF_CALC_GAIN_BAR_CLASS)}
            style={{ left: `${investedShare}%`, width: `${gainShare}%` }}
          />
        ) : null}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className={MF_CALC_INVESTED_DOT_CLASS} />
          {copy.mutualFunds.lumpsumInvestedAmount}: {formatInr(invested)}
        </span>
        <span className={cn("inline-flex items-center gap-1.5", MF_CALC_GAIN_TEXT_CLASS)}>
          <span className={MF_CALC_GAIN_DOT_CLASS} />
          {copy.mutualFunds.lumpsumChartGain}: {formatInr(gains)}
        </span>
      </div>
    </div>
  );
}

type LumpsumHorizonTabsProps = {
  scenarios: InvestReturnCalculatorScenario[];
  selectedHorizon: string;
  bestHorizon?: string;
  onSelect: (horizon: string) => void;
};

function LumpsumHorizonTabs({
  scenarios,
  selectedHorizon,
  bestHorizon,
  onSelect,
}: LumpsumHorizonTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={copy.mutualFunds.lumpsumChartTitle}
      className="flex border-b border-[var(--sip-panel-border)]"
    >
      {scenarios.map((scenario) => {
        const isSelected = selectedHorizon === scenario.horizon;
        const isBest = bestHorizon === scenario.horizon;

        return (
          <button
            key={scenario.horizon}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(scenario.horizon)}
            className={cn(
              "relative flex-1 px-2 py-2.5 text-caption font-medium uppercase tracking-wide transition-colors",
              isSelected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="inline-flex items-center justify-center gap-1">
              {scenario.horizon}
              {isBest ? (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_14%,transparent)] px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-[var(--success)]">
                  Best
                </span>
              ) : null}
            </span>
            {isSelected ? (
              <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-foreground" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type LumpsumResultsCardProps = {
  result: MfLumpsumCalculator;
};

function LumpsumResultsCard({ result }: LumpsumResultsCardProps) {
  const bestScenario = useMemo(() => findBestScenario(result.scenarios), [result.scenarios]);
  const defaultHorizon = bestScenario?.horizon ?? result.scenarios[0]?.horizon ?? "";
  const [selectedHorizon, setSelectedHorizon] = useState(defaultHorizon);

  useEffect(() => {
    setSelectedHorizon(defaultHorizon);
  }, [defaultHorizon, result.amount_inr, result.product_id]);

  const selectedScenario = useMemo(
    () =>
      result.scenarios.find((scenario) => scenario.horizon === selectedHorizon) ??
      result.scenarios[0] ??
      null,
    [result.scenarios, selectedHorizon],
  );

  if (!selectedScenario) return null;

  return (
    <Card className={cn("h-full", MF_CALC_CARD_CLASS)}>
      <CardContent className={cn("h-full", MF_CALC_CARD_CONTENT_CLASS)}>
        <div className="flex items-center gap-2.5 text-body font-semibold tracking-tight">
          <span className={MF_CALC_ICON_BADGE_CLASS}>
            <TrendingUp className="size-4" strokeWidth={2.25} />
          </span>
          {copy.mutualFunds.lumpsumResultsTitle}
        </div>

        <LumpsumHorizonTabs
          scenarios={result.scenarios}
          selectedHorizon={selectedHorizon}
          bestHorizon={bestScenario?.horizon}
          onSelect={setSelectedHorizon}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-h2 font-semibold tracking-tight tabular-nums text-foreground">
              {formatInr(selectedScenario.value_inr)}
            </p>
            <p className="mt-1 text-caption text-muted-foreground">
              {copy.mutualFunds.lumpsumChartValue}
              {result.as_of_date ? ` · ${formatDate(result.as_of_date)}` : ""}
            </p>

            <LumpsumCorpusProgress
              invested={result.amount_inr}
              projectedValue={selectedScenario.value_inr}
            />
          </div>

          <LumpsumCorpusDonut
            invested={result.amount_inr}
            projectedValue={selectedScenario.value_inr}
            horizonLabel={selectedScenario.horizon.toUpperCase()}
            returnPct={selectedScenario.return_pct}
            showLegend={false}
            className="lg:px-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function MfLumpsumCalculatorView() {
  const searchParams = useSearchParams();
  const [fund, setFund] = useState<InvestFundSummary | null>(null);
  const [amount, setAmount] = useState(LUMPSUM_CALCULATOR_DEFAULT_AMOUNT);
  const [result, setResult] = useState<MfLumpsumCalculator | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minLumpsumAmount = useMemo(
    () => resolveMinLumpsumAmount(fund?.min_lumpsum_amount_inr),
    [fund?.min_lumpsum_amount_inr],
  );
  const amountStep = useMemo(
    () => lumpsumAmountStep(fund?.min_lumpsum_amount_inr, amount),
    [amount, fund?.min_lumpsum_amount_inr],
  );

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
    setAmount((current) => clampLumpsumAmount(current, fund?.min_lumpsum_amount_inr));
  }, [fund?.min_lumpsum_amount_inr]);

  useEffect(() => {
    if (!fund?.product_id || amount <= 0) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timeout = window.setTimeout(() => {
      fetchLumpsumCalculatorWithFallback(fund.product_id, { amount_inr: amount })
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
  }, [amount, fund?.product_id]);

  const hasResult = Boolean(!loading && result && result.scenarios.length > 0);

  const growthChartSeries = useMemo(() => {
    if (hasResult && result) {
      const fromPoints = calculatorPointsToSeries(result.points);
      if (fromPoints.length >= 2) {
        return fromPoints;
      }
      return scenariosToChartSeries(result.scenarios);
    }
    return LUMPSUM_PLACEHOLDER_CHART_SERIES;
  }, [hasResult, result]);

  const growthChartLabels = useMemo(
    () => ({
      value: copy.mutualFunds.lumpsumChartValue,
      invested: copy.mutualFunds.lumpsumChartInvested,
      gain: copy.mutualFunds.lumpsumChartGain,
      empty: copy.mutualFunds.lumpsumChartEmpty,
      lockedTitle: copy.mutualFunds.lumpsumChartLockedTitle,
      lockedMessage: copy.mutualFunds.lumpsumChartNoFund,
    }),
    [],
  );

  return (
    <DashboardContentFade>
      <MfToolsPageShell
        trail={[
          { label: copy.mutualFunds.lumpsumCalcTitle, href: "/dashboard/mutual-funds/calculators/lumpsum" },
        ]}
        title={copy.mutualFunds.lumpsumCalcTitle}
        icon={MF_TOOL_ICONS["lumpsum-calc"]}
      >
      <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card className={cn("h-full", MF_CALC_CARD_CLASS)}>
          <CardContent className={MF_CALC_CARD_CONTENT_CLASS}>
            <div className="flex items-center gap-2.5 text-body font-semibold tracking-tight">
              <LineChart
                className={cn("size-5 shrink-0", PAGE_HEADER_ICON_CLASS)}
                strokeWidth={2.25}
              />
              {copy.mutualFunds.lumpsumInputsTitle}
            </div>

            <MfFundPicker value={fund} onChange={setFund} />

            <MfCalculatorSliderField
              id="lumpsum-amount"
              label={copy.mutualFunds.lumpsumAmountLabel}
              valueLabel={formatInr(amount)}
              prominentValue
              minLabel={formatInr(minLumpsumAmount)}
              maxLabel={formatInr(LUMPSUM_CALCULATOR_MAX_AMOUNT, { compact: true })}
              value={amount}
              min={minLumpsumAmount}
              max={LUMPSUM_CALCULATOR_MAX_AMOUNT}
              step={amountStep}
              disabled={!fund}
              onValueChange={(nextAmount) => {
                setAmount(clampLumpsumAmount(nextAmount, fund?.min_lumpsum_amount_inr));
              }}
            />
          </CardContent>
        </Card>

        <div className="flex h-full min-h-0 flex-col gap-4">
          {!fund ? (
            <Card className={cn("h-full flex-1 border border-dashed border-border bg-transparent py-0 shadow-none ring-0 [--card-spacing:0]", ZYND_3XL_RADIUS_CLASS)}>
              <CardContent className="flex h-full min-h-full flex-col items-center justify-center gap-3 p-5 text-center sm:p-6">
                <TrendingUp className="size-8 text-[var(--sip-empty-icon)]" />
                <div>
                  <p className="text-compact font-medium text-foreground">
                    {copy.mutualFunds.lumpsumSelectFundPrompt}
                  </p>
                  <p className="mt-1 max-w-md text-caption text-muted-foreground">
                    {copy.mutualFunds.lumpsumSelectFundPromptDescription}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {fund && error ? <FieldMessage variant="error" message={error} /> : null}

          {fund && loading ? <MfLumpsumCalculatorResultsSkeleton /> : null}

          {!loading && result && result.scenarios.length === 0 ? (
            <FieldMessage variant="info" message={copy.mutualFunds.calculatorDataShallow} />
          ) : null}

          {fund && hasResult && result ? <LumpsumResultsCard result={result} /> : null}
        </div>
      </div>

        <Card className={cn("w-full", MF_CALC_CARD_CLASS)}>
          <CardContent className={cn(MF_CALC_CARD_CONTENT_CLASS, "gap-4")}>
            <MfGrowthProjectionHeader
              title={copy.mutualFunds.sipChartTitle}
              description={copy.mutualFunds.lumpsumChartDescription}
            />

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className={MF_CALC_INVESTED_DOT_CLASS} aria-hidden />
                {copy.mutualFunds.lumpsumChartInvested}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={MF_CALC_GAIN_DOT_CLASS} aria-hidden />
                {copy.mutualFunds.lumpsumChartGain}
              </span>
            </div>

            <MfCalculatorProjectionChartPanel
              series={growthChartSeries}
              labels={growthChartLabels}
              locked={!fund}
              loading={Boolean(fund && loading)}
              emptyMessage={copy.mutualFunds.lumpsumChartEmpty}
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
    </DashboardContentFade>
  );
}
