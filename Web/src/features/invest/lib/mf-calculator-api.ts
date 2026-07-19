import { ApiError } from "@/lib/api-client";
import {
  fetchInvestConfig,
  fetchInvestReturnCalculator,
  fetchMfLumpsumCalculator,
  fetchMfSipCalculator,
  type InvestReturnCalculator,
  type InvestReturnCalculatorScenario,
  type MfLumpsumCalculator,
  type MfSipCalculator,
} from "@/features/invest/api/invest-api";

export const CALCULATOR_HORIZON_MONTHS = [
  { horizon: "3m", durationMonths: 3 },
  { horizon: "6m", durationMonths: 6 },
  { horizon: "1y", durationMonths: 12 },
  { horizon: "3y", durationMonths: 36 },
  { horizon: "5y", durationMonths: 60 },
] as const;

async function defaultDisclaimer() {
  try {
    const config = await fetchInvestConfig();
    return config.disclaimer;
  } catch {
    return "";
  }
}

export async function fetchLumpsumCalculatorWithFallback(
  productId: string,
  params?: { amount_inr?: number; horizons?: string },
): Promise<MfLumpsumCalculator> {
  try {
    return await fetchMfLumpsumCalculator(productId, params);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }

    const legacy = await fetchInvestReturnCalculator(productId, {
      amount_inr: params?.amount_inr,
      mode: "lumpsum",
      horizons: params?.horizons,
    });
    const disclaimer = legacy.disclaimer ?? (await defaultDisclaimer());

    return {
      product_id: legacy.product_id,
      mode: "lumpsum",
      amount_inr: legacy.amount_inr,
      as_of_date: legacy.as_of_date,
      data_quality: legacy.data_quality ?? "ok",
      disclaimer,
      scenarios: legacy.scenarios,
      points: [],
    };
  }
}

export async function fetchSipCalculatorWithFallback(
  productId: string,
  params: { monthly_amount_inr: number; duration_months: number; sip_day: number },
): Promise<MfSipCalculator> {
  try {
    return await fetchMfSipCalculator(productId, params);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }

    const legacy = await fetchInvestReturnCalculator(productId, {
      amount_inr: params.monthly_amount_inr,
      mode: "sip",
      duration_months: params.duration_months,
      sip_day: params.sip_day,
    });
    const disclaimer = legacy.disclaimer ?? (await defaultDisclaimer());
    const scenario = legacy.scenarios[0];

    return {
      product_id: legacy.product_id,
      mode: "sip",
      monthly_amount_inr: legacy.amount_inr,
      duration_months: params.duration_months,
      sip_day: params.sip_day,
      total_invested_inr: scenario?.invested_inr ?? params.monthly_amount_inr * params.duration_months,
      projected_value_inr: scenario?.value_inr ?? 0,
      return_pct: scenario?.return_pct ?? null,
      xirr_pct: null,
      installments: params.duration_months,
      as_of_date: legacy.as_of_date,
      data_quality: legacy.data_quality ?? "ok",
      disclaimer,
      points: [],
    };
  }
}

export async function fetchSipHorizonsCalculatorWithFallback(
  productId: string,
  monthlyAmountInr: number,
): Promise<InvestReturnCalculator> {
  const scenarios: InvestReturnCalculatorScenario[] = [];
  let asOfDate: string | null = null;
  let disclaimer = "";
  let dataQuality = "ok";

  await Promise.all(
    CALCULATOR_HORIZON_MONTHS.map(async ({ horizon, durationMonths }) => {
      const result = await fetchSipCalculatorWithFallback(productId, {
        monthly_amount_inr: monthlyAmountInr,
        duration_months: durationMonths,
        sip_day: 5,
      });
      scenarios.push({
        horizon,
        invested_inr: result.total_invested_inr,
        value_inr: result.projected_value_inr,
        return_pct: result.return_pct,
      });
      asOfDate = asOfDate ?? result.as_of_date;
      disclaimer = disclaimer || result.disclaimer;
      dataQuality = result.data_quality ?? dataQuality;
    }),
  );

  scenarios.sort(
    (left, right) =>
      CALCULATOR_HORIZON_MONTHS.findIndex((item) => item.horizon === left.horizon) -
      CALCULATOR_HORIZON_MONTHS.findIndex((item) => item.horizon === right.horizon),
  );

  if (!disclaimer) {
    disclaimer = await defaultDisclaimer();
  }

  return {
    product_id: productId,
    amount_inr: monthlyAmountInr,
    mode: "sip",
    as_of_date: asOfDate,
    data_quality: dataQuality,
    disclaimer,
    scenarios,
  };
}
