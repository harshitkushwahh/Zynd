import type { InvestSipOption } from "@/features/invest/api/invest-api";
import { copy } from "@/shared/config/copy";
import { formatInr } from "@/features/invest/lib/mf-format";
import { SIP_ORDER_DEFAULT_INSTALLMENTS } from "@/features/invest/lib/mf-sip-calculator";

export const SIP_FREQUENCY_MONTHLY = "monthly" as const;
export const SIP_FREQUENCY_DAILY = "daily" as const;

export type SipFrequency = typeof SIP_FREQUENCY_MONTHLY | typeof SIP_FREQUENCY_DAILY;

/** Align with Backend `zynd_mf_sip_default_daily_installments` (default 30). */
export const SIP_DEFAULT_DAILY_INSTALLMENTS = 30;

export function normalizeSipFrequency(value?: string | null): SipFrequency {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === SIP_FREQUENCY_DAILY) return SIP_FREQUENCY_DAILY;
  return SIP_FREQUENCY_MONTHLY;
}

export function isDailySipFrequency(frequency?: string | null) {
  return normalizeSipFrequency(frequency) === SIP_FREQUENCY_DAILY;
}

export function resolveSipOption(
  sipOptions: InvestSipOption[] | undefined,
  frequency: SipFrequency,
): InvestSipOption | null {
  const list = sipOptions ?? [];
  return (
    list.find((option) => (option.frequency ?? "").trim().toLowerCase() === frequency) ?? null
  );
}

export function isDailySipAllowed(sipOptions: InvestSipOption[] | undefined) {
  const list = sipOptions ?? [];
  if (list.length === 0) return false;
  return list.some((option) => (option.frequency ?? "").trim().toLowerCase() === SIP_FREQUENCY_DAILY);
}

export function isMonthlySipAllowed(
  sipOptions: InvestSipOption[] | undefined,
  fallback?: { sipAllowed?: boolean; minSipAmountInr?: number | null },
) {
  const list = sipOptions ?? [];
  if (list.length === 0) {
    return Boolean(fallback?.sipAllowed ?? fallback?.minSipAmountInr != null);
  }
  return list.some((option) => (option.frequency ?? "").trim().toLowerCase() === SIP_FREQUENCY_MONTHLY);
}

export function resolveDefaultSipFrequency(
  sipOptions: InvestSipOption[] | undefined,
  fallback?: { sipAllowed?: boolean; minSipAmountInr?: number | null },
): SipFrequency {
  const monthly = isMonthlySipAllowed(sipOptions, fallback);
  const daily = isDailySipAllowed(sipOptions);
  if (monthly) return SIP_FREQUENCY_MONTHLY;
  if (daily) return SIP_FREQUENCY_DAILY;
  return SIP_FREQUENCY_MONTHLY;
}

export function resolveMinSipForFrequency(
  frequency: SipFrequency,
  sipOptions: InvestSipOption[] | undefined,
  fallbackMinSipAmountInr?: number | null,
): number | null {
  const option = resolveSipOption(sipOptions, frequency);
  if (option?.min_inr != null && option.min_inr > 0) return option.min_inr;
  if (frequency === SIP_FREQUENCY_MONTHLY && fallbackMinSipAmountInr != null && fallbackMinSipAmountInr > 0) {
    return fallbackMinSipAmountInr;
  }
  return null;
}

export function resolveMinInstallmentsForFrequency(
  frequency: SipFrequency,
  sipOptions: InvestSipOption[] | undefined,
): number | null {
  const option = resolveSipOption(sipOptions, frequency);
  if (option?.min_installments != null && option.min_installments > 0) {
    return option.min_installments;
  }
  return null;
}

/** No scheme minimum on installments means any count is allowed. */
export function formatMinInstallmentsDisplay(minInstallments?: number | null): string {
  if (minInstallments != null && minInstallments > 0) {
    return String(minInstallments);
  }
  return copy.mutualFunds.sipMinInstallmentsAny;
}

export function defaultInstallmentsForFrequency(frequency: SipFrequency) {
  return frequency === SIP_FREQUENCY_DAILY
    ? SIP_DEFAULT_DAILY_INSTALLMENTS
    : SIP_ORDER_DEFAULT_INSTALLMENTS;
}

export function validateSipInstallmentAmount(
  amount: number,
  frequency: SipFrequency,
  sipOptions: InvestSipOption[] | undefined,
  fallbackMinSipAmountInr?: number | null,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const min = resolveMinSipForFrequency(frequency, sipOptions, fallbackMinSipAmountInr);
  if (min != null && amount < min) {
    return copy.mutualFunds.paymentCardMinAmountHint.replace("{amount}", formatInr(min));
  }
  const option = resolveSipOption(sipOptions, frequency);
  if (option?.max_inr != null && amount > option.max_inr) {
    return copy.mutualFunds.paymentCardMaxAmountHint.replace("{amount}", formatInr(option.max_inr));
  }
  const multiples = option?.multiples_inr;
  if (multiples != null && multiples > 0 && amount % multiples !== 0) {
    return copy.mutualFunds.paymentCardSipAmountMultiple.replace("{amount}", formatInr(multiples));
  }
  return null;
}

export function validateSipInstallmentCount(
  count: number,
  frequency: SipFrequency,
  sipOptions: InvestSipOption[] | undefined,
): string | null {
  const min = resolveMinInstallmentsForFrequency(frequency, sipOptions);
  if (min != null && count < min) {
    return copy.mutualFunds.paymentCardMinInstallments.replace("{count}", String(min));
  }
  return null;
}
