import type { InvestReturnCalculatorScenario, MfCalculatorPoint } from "@/features/invest/api/invest-api";

export const LUMPSUM_CALCULATOR_MAX_AMOUNT = 10_00_00_000;
export const LUMPSUM_CALCULATOR_DEFAULT_MIN_AMOUNT = 5_000;
export const LUMPSUM_CALCULATOR_DEFAULT_AMOUNT = 10_000;

export function resolveMinLumpsumAmount(minLumpsumAmountInr: number | null | undefined) {
  const resolved = minLumpsumAmountInr ?? LUMPSUM_CALCULATOR_DEFAULT_MIN_AMOUNT;
  return Math.min(Math.max(resolved, 1), LUMPSUM_CALCULATOR_MAX_AMOUNT);
}

export function clampLumpsumAmount(amount: number, minLumpsumAmountInr: number | null | undefined) {
  const min = resolveMinLumpsumAmount(minLumpsumAmountInr);
  return Math.min(Math.max(amount, min), LUMPSUM_CALCULATOR_MAX_AMOUNT);
}

export function lumpsumAmountStep(minLumpsumAmountInr: number | null | undefined, currentAmount?: number) {
  const min = resolveMinLumpsumAmount(minLumpsumAmountInr);
  const amount = currentAmount ?? min;
  if (amount >= 1_00_00_000) return 10_00_000;
  if (amount >= 50_00_000) return 5_00_000;
  if (amount >= 10_00_000) return 1_00_000;
  if (min >= 50_000) return 5_000;
  if (min >= 10_000) return 1_000;
  if (min >= 1_000) return 500;
  return 100;
}

export type CalculatorChartSeriesPoint = {
  label: string;
  invested: number;
  value: number;
  gain: number;
};

export function calculatorPointsToSeries(points: readonly MfCalculatorPoint[]): CalculatorChartSeriesPoint[] {
  return points.map((point) => {
    const invested = point.invested_inr ?? 0;
    const value = point.value_inr;
    return {
      label: point.date,
      invested,
      value,
      gain: Math.max(0, value - invested),
    };
  });
}

export function scenariosToChartSeries(
  scenarios: readonly InvestReturnCalculatorScenario[],
): CalculatorChartSeriesPoint[] {
  return scenarios.map((scenario) => ({
    label: scenario.horizon.toUpperCase(),
    invested: scenario.invested_inr,
    value: scenario.value_inr,
    gain: Math.max(0, scenario.value_inr - scenario.invested_inr),
  }));
}

/** Illustrative lumpsum growth by horizon — shown before a fund is selected. */
export const LUMPSUM_PLACEHOLDER_CHART_SERIES: CalculatorChartSeriesPoint[] = [
  { label: "1Y", invested: 1_00_000, value: 1_12_000, gain: 12_000 },
  { label: "3Y", invested: 1_00_000, value: 1_38_000, gain: 38_000 },
  { label: "5Y", invested: 1_00_000, value: 1_65_000, gain: 65_000 },
  { label: "7Y", invested: 1_00_000, value: 1_98_000, gain: 98_000 },
  { label: "10Y", invested: 1_00_000, value: 2_45_000, gain: 1_45_000 },
];
