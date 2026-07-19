export const SIP_CALCULATOR_MAX_AMOUNT = 100_000;
export const SIP_CALCULATOR_DEFAULT_MIN_AMOUNT = 500;
export const SIP_CALCULATOR_MIN_INSTALLMENTS = 1;
export const SIP_CALCULATOR_MAX_INSTALLMENTS = 999;
export const SIP_CALCULATOR_DEFAULT_INSTALLMENTS = 60;
export const SIP_CALCULATOR_DEFAULT_DAY = 5;

export function resolveMinSipAmount(minSipAmountInr: number | null | undefined) {
  const resolved = minSipAmountInr ?? SIP_CALCULATOR_DEFAULT_MIN_AMOUNT;
  return Math.min(Math.max(resolved, 1), SIP_CALCULATOR_MAX_AMOUNT);
}

export function clampSipAmount(amount: number, minSipAmountInr: number | null | undefined) {
  const min = resolveMinSipAmount(minSipAmountInr);
  return Math.min(Math.max(amount, min), SIP_CALCULATOR_MAX_AMOUNT);
}

export function clampInstallments(installments: number) {
  return Math.min(
    Math.max(installments, SIP_CALCULATOR_MIN_INSTALLMENTS),
    SIP_CALCULATOR_MAX_INSTALLMENTS,
  );
}

export function formatInstallmentDuration(installments: number) {
  const years = Math.floor(installments / 12);
  const months = installments % 12;

  if (years === 0) {
    return `${installments} mo`;
  }

  if (months === 0) {
    return `${installments} mo (${years} yr${years === 1 ? "" : "s"})`;
  }

  return `${installments} mo (${years} yr${years === 1 ? "" : "s"} ${months} mo)`;
}

export function sipAmountStep(minSipAmountInr: number | null | undefined) {
  const min = resolveMinSipAmount(minSipAmountInr);
  if (min >= 5_000) return 500;
  if (min >= 1_000) return 100;
  return 50;
}

/** Illustrative SIP growth curve shown before a fund is selected. */
export const SIP_PLACEHOLDER_PROJECTION_POINTS = [
  { date: "2021-07-05", invested_inr: 35_000, value_inr: 38_000, units: null },
  { date: "2022-06-05", invested_inr: 95_000, value_inr: 112_000, units: null },
  { date: "2023-05-05", invested_inr: 155_000, value_inr: 198_000, units: null },
  { date: "2024-04-05", invested_inr: 215_000, value_inr: 298_000, units: null },
  { date: "2025-03-05", invested_inr: 275_000, value_inr: 428_000, units: null },
  { date: "2026-02-05", invested_inr: 300_000, value_inr: 1_460_000, units: null },
] as const;
