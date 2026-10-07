import type { MfMandate, MfMandateType } from "@/features/invest/api/invest-api";

export const MANDATE_LIMIT_UP_TO_15K = 15_000;
export const MANDATE_LIMIT_UP_TO_50K = 50_000;
export const MANDATE_LIMIT_UP_TO_1L = 100_000;

/** Same tiers as the backend mandate ceiling: up to ₹15,000, ₹50,000, or ₹1,00,000. */
export function requiredMandateLimitInr(amountInr: number) {
  if (amountInr >= 50_000) return MANDATE_LIMIT_UP_TO_1L;
  if (amountInr >= 15_000) return MANDATE_LIMIT_UP_TO_50K;
  return MANDATE_LIMIT_UP_TO_15K;
}

function mandateTypeMatches(mandateType: string | null | undefined, selected: MfMandateType) {
  const normalized = (mandateType ?? "").trim().toLowerCase();
  return selected === "nach" ? normalized === "nach" : normalized === "upi";
}

export function findCoveringApprovedMandate(
  mandates: MfMandate[],
  options: {
    bankAccountId: string | null;
    mandateType: MfMandateType;
    requiredLimitInr: number;
  },
) {
  const matches = mandates.filter((mandate) => {
    if (mandate.status?.toUpperCase() !== "APPROVED") return false;
    if ((mandate.mandate_limit ?? 0) < options.requiredLimitInr) return false;
    if (!mandateTypeMatches(mandate.mandate_type, options.mandateType)) return false;
    if (
      options.bankAccountId &&
      mandate.investor_bank_account_id &&
      mandate.investor_bank_account_id !== options.bankAccountId
    ) {
      return false;
    }
    return true;
  });

  return (
    matches.sort((left, right) => (right.mandate_limit ?? 0) - (left.mandate_limit ?? 0))[0] ??
    null
  );
}
