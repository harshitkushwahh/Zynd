/** Resolve server-masked sensitive values from KYC draft payloads. */

type PanDraftLike = {
  panNumber?: string;
  panMasked?: string;
  panLast4?: string;
};

type BankDraftLike = {
  accountNumber?: string;
  accountNumberMasked?: string;
  accountNumberLast4?: string;
};

export function resolvePanDisplay(draft: PanDraftLike | null | undefined): string | null {
  if (!draft) return null;
  const masked = draft.panMasked?.trim();
  if (masked) return masked;
  const panNumber = draft.panNumber?.trim();
  if (!panNumber) {
    const last4 = draft.panLast4?.trim();
    return last4 ? `•••• •••• ${last4}` : null;
  }
  return panNumber;
}

export function resolveAccountNumberDisplay(draft: BankDraftLike | null | undefined): string | null {
  if (!draft) return null;
  const masked = draft.accountNumberMasked?.trim();
  if (masked) return masked;
  const accountNumber = draft.accountNumber?.trim();
  if (!accountNumber) {
    const last4 = draft.accountNumberLast4?.trim();
    return last4 ? `•••• ${last4}` : null;
  }
  return accountNumber;
}

export function resolveAccountNumberLast4(draft: BankDraftLike | null | undefined): string | null {
  if (!draft) return null;
  const last4 = draft.accountNumberLast4?.trim();
  if (last4) return last4;
  const accountNumber = draft.accountNumber?.trim();
  if (!accountNumber || accountNumber.length < 4) return accountNumber || null;
  return accountNumber.slice(-4);
}
