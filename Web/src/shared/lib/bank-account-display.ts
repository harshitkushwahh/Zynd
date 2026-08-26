import {
  parseBankNameFromAccountLabel,
  resolveIndianBankDisplayName,
} from "@/shared/lib/indian-bank-logo";

export function extractAccountLast4(input?: string | null): string | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(\d{4})\s*$/);
  return match?.[1] ?? null;
}

export function formatMaskedBankAccountSuffix(last4?: string | null): string {
  const digits = last4?.trim();
  return digits ? `•••• ${digits}` : "";
}

export function resolveBankAccountDisplayName(input: {
  bankName?: string | null;
  ifscCode?: string | null;
  accountLabel?: string | null;
}): string | null {
  const fromStored = input.bankName?.trim();
  if (fromStored && fromStored.toLowerCase() !== "bank") {
    return resolveIndianBankDisplayName({ bankName: fromStored, ifscCode: input.ifscCode }) ?? fromStored;
  }

  const fromIfsc = resolveIndianBankDisplayName({ ifscCode: input.ifscCode });
  if (fromIfsc) return fromIfsc;

  const fromLabel = parseBankNameFromAccountLabel(input.accountLabel);
  if (fromLabel && fromLabel.toLowerCase() !== "bank") {
    return resolveIndianBankDisplayName({ bankName: fromLabel, ifscCode: input.ifscCode }) ?? fromLabel;
  }

  return fromStored || null;
}

export function formatBankAccountPickerLabel(input: {
  bankName?: string | null;
  ifscCode?: string | null;
  accountLabel?: string | null;
  accountNumberMasked?: string | null;
  accountNumberLast4?: string | null;
  unknownBankLabel: string;
}): string {
  const resolvedName =
    resolveBankAccountDisplayName({
      bankName: input.bankName,
      ifscCode: input.ifscCode,
      accountLabel: input.accountLabel,
    }) ?? input.unknownBankLabel;

  const masked =
    input.accountNumberMasked?.trim() ||
    formatMaskedBankAccountSuffix(
      input.accountNumberLast4?.trim() || extractAccountLast4(input.accountLabel),
    );

  return masked ? `${resolvedName} ${masked}` : resolvedName;
}
