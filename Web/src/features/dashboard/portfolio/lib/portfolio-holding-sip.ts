import type { MfSipPlan } from "@/features/invest/api/invest-api";
import { formatDate, formatInr } from "@/features/invest/lib/mf-format";

export type HoldingSipPool = {
  activePlanCount: number;
  /** Sum of monthly-frequency plan amounts only. */
  monthlySipInr: number;
  /** Sum of daily-frequency per-installment amounts. */
  dailySipInr: number;
  /** Monthly plans plus daily × 30 for overview-style totals. */
  monthlyEquivalentInr: number;
  nextInstallmentDate: string | null;
};

export type PortfolioHoldingSipMatch = {
  isin?: string | null;
  fundName: string;
};

function normalizeFundName(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

const NON_OPERATIONAL_FP_STATES = new Set(["cancelled", "completed", "failed", "rejected", "expired"]);

function isActiveSipPlan(plan: MfSipPlan) {
  const status = (plan.status ?? "").trim().toUpperCase();
  if (status !== "ACTIVE") return false;
  const fpState = (plan.fp_state ?? "").trim().toLowerCase();
  if (fpState && NON_OPERATIONAL_FP_STATES.has(fpState)) return false;
  return true;
}

export function matchSipPlansToHolding(holding: PortfolioHoldingSipMatch, plans: MfSipPlan[]) {
  const holdingIsin = holding.isin?.trim().toUpperCase() ?? "";
  const holdingName = normalizeFundName(holding.fundName);

  return plans.filter((plan) => {
    if (!isActiveSipPlan(plan)) return false;
    const planIsin = plan.isin?.trim().toUpperCase() ?? "";
    if (holdingIsin && planIsin && holdingIsin === planIsin) return true;
    const planName = normalizeFundName(plan.product_name);
    if (!planName || !holdingName) return false;
    return planName === holdingName || planName.includes(holdingName) || holdingName.includes(planName);
  });
}

export function poolSipsForHolding(holding: PortfolioHoldingSipMatch, plans: MfSipPlan[]): HoldingSipPool | null {
  const matched = matchSipPlansToHolding(holding, plans);
  if (matched.length === 0) return null;

  let monthlySipInr = 0;
  let dailySipInr = 0;
  for (const plan of matched) {
    const frequency = (plan.frequency ?? "").trim().toLowerCase();
    if (frequency === "daily") dailySipInr += plan.amount_inr;
    else monthlySipInr += plan.amount_inr;
  }
  const monthlyEquivalentInr = monthlySipInr + dailySipInr * 30;

  const nextInstallmentDate =
    matched
      .map((plan) => plan.next_installment_date)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? null;

  return {
    activePlanCount: matched.length,
    monthlySipInr,
    dailySipInr,
    monthlyEquivalentInr,
    nextInstallmentDate,
  };
}

export function formatHoldingSipPoolSummary(pool: HoldingSipPool) {
  const monthly = formatInr(pool.monthlySipInr);
  const daily = formatInr(pool.dailySipInr);
  const monthlyEquivalent = formatInr(pool.monthlyEquivalentInr);
  const nextDate = pool.nextInstallmentDate ? formatDate(pool.nextInstallmentDate) : null;
  return { monthly, daily, monthlyEquivalent, nextDate };
}
