import { copy } from "@/shared/config/copy";

export { KYC_BANK_ACCOUNT_TYPE_OPTIONS } from "@/features/kyc/lib/kyc-master-data-options";

export type KycBankAccountType = "Savings" | "Current" | "NRE" | "NRO";

/** @deprecated Use KYC_BANK_ACCOUNT_TYPE_OPTIONS */
export const KYC_BANK_ACCOUNT_TYPES: readonly KycBankAccountType[] = [
  "Savings",
  "Current",
  "NRE",
  "NRO",
] as const;

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Legacy flows stored the field label "Branch" when only the bank name was inferred from IFSC. */
export function isKycBankBranchPlaceholder(branch: string | null | undefined): boolean {
  return branch?.trim().toLowerCase() === "branch";
}
export const ACCOUNT_NUMBER_MIN_LENGTH = 9;
export const ACCOUNT_NUMBER_MAX_LENGTH = 18;
export const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;

export type KycBankFetchResult = {
  accountHolderName: string;
};

export type KycBankAccountDetails = KycBankFetchResult & {
  bankName: string;
  branch: string;
};

export type KycBankFormValue = {
  accountNumber: string;
  accountNumberMasked?: string;
  accountNumberLast4?: string;
  accountType: string;
  ifscCode: string;
};

export type KycBankVerificationResult = {
  panVerified: boolean;
  bankVerified: boolean;
  readinessVerified: boolean;
  bankName: string;
  branch: string;
  requiresManualVerification?: boolean;
  requiresProofUpload?: boolean;
  preverifyId?: string;
  failureReason?: string;
};

export function bankAccountNumberOnFile(form: KycBankFormValue) {
  if (form.accountNumber.trim()) {
    return false;
  }
  return Boolean(form.accountNumberLast4?.trim() || form.accountNumberMasked?.trim());
}

export function validateKycBankForm(
  form: KycBankFormValue,
  options?: { accountNumberOnFile?: boolean },
) {
  const errors: Partial<Record<keyof KycBankFormValue, string>> = {};
  const accountOnFile = options?.accountNumberOnFile ?? bankAccountNumberOnFile(form);

  if (!accountOnFile) {
    if (!form.accountNumber.trim()) {
      errors.accountNumber = copy.kyc.bank.requiredField;
    } else if (!ACCOUNT_NUMBER_PATTERN.test(form.accountNumber)) {
      errors.accountNumber = copy.kyc.bank.invalidAccountNumber;
    }
  }

  if (!form.accountType) {
    errors.accountType = copy.kyc.bank.requiredField;
  }

  if (!form.ifscCode.trim()) {
    errors.ifscCode = copy.kyc.bank.requiredField;
  } else if (!IFSC_PATTERN.test(form.ifscCode)) {
    errors.ifscCode = copy.kyc.bank.invalidIfsc;
  }

  return errors;
}

export function createEmptyBankForm(): KycBankFormValue {
  return {
    accountNumber: "",
    accountType: "",
    ifscCode: "",
  };
}

export function normalizeIfscCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
}

export function normalizeAccountNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_MAX_LENGTH);
}
