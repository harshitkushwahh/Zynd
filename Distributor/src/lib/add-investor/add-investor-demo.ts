import type {
  AddInvestorAddressDraft,
  AddInvestorAddressFields,
  AddInvestorPanName,
  AddInvestorReadiness,
} from "@/lib/add-investor/add-investor-journey";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** K in 4th character of PAN suffix pattern → demo KRA-registered investor */
const KRA_DEMO_PAN_PATTERN = /^[A-Z]{4}K[0-9]{4}[A-Z]$/;

/** 5th character K → demo KRA-registered investor (skips DigiLocker). */
export const ADD_INVESTOR_DEMO_PAN_KRA = "ABCPK1234A";

/** 5th character P → demo new-to-KYC investor (DigiLocker, signature, e-sign). */
export const ADD_INVESTOR_DEMO_PAN_DIGILOCKER = "ABCPN1234A";

export type AddInvestorPanVerifyResult =
  | { ok: true; panName: AddInvestorPanName; kycAlreadyRegistered: boolean; readiness: AddInvestorReadiness }
  | { ok: false; error: string };

export function normalizePanInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function normalizeMobileInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function verifyDemoPan(pan: string): AddInvestorPanVerifyResult {
  if (!PAN_PATTERN.test(pan)) {
    return {
      ok: false,
      error: `Enter a valid 10-character PAN (e.g. ${ADD_INVESTOR_DEMO_PAN_KRA} or ${ADD_INVESTOR_DEMO_PAN_DIGILOCKER}).`,
    };
  }

  const kycAlreadyRegistered = KRA_DEMO_PAN_PATTERN.test(pan);

  const panName: AddInvestorPanName = kycAlreadyRegistered
    ? {
        firstName: "Rajesh",
        lastName: "Kumar",
        dateOfBirth: "1988-04-12",
        panCategory: "Individual",
      }
    : {
        firstName: "Priya",
        lastName: "Sharma",
        dateOfBirth: "1993-09-03",
        panCategory: "Individual",
      };

  const readiness: AddInvestorReadiness = kycAlreadyRegistered
    ? {
        code: "kyc_registered",
        label: "KRA registered",
        hint: "Investor is KRA compliant. Skip DigiLocker, signature, and e-sign — capture address manually.",
      }
    : {
        code: "new_to_kyc",
        label: "New to KYC",
        hint: "Full KYC required. Continue with DigiLocker to fetch Aadhaar address.",
      };

  return { ok: true, panName, kycAlreadyRegistered, readiness };
}

export const DIGILOCKER_PREFILL_ADDRESS: AddInvestorAddressFields = {
  line1: "118 Kara's Dev Nager",
  line2: "Sukhlia Main Road",
  city: "Indore",
  state: "Madhya Pradesh",
  pincode: "452011",
  country: "india",
};

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const DEMO_BANK_BY_PREFIX: Record<string, { bankName: string; branchName: string }> = {
  HDFC: { bankName: "HDFC Bank", branchName: "Koramangala" },
  SBIN: { bankName: "State Bank of India", branchName: "MG Road" },
  ICIC: { bankName: "ICICI Bank", branchName: "Indiranagar" },
  UTIB: { bankName: "Axis Bank", branchName: "Whitefield" },
  KKBK: { bankName: "Kotak Mahindra Bank", branchName: "HSR Layout" },
};

/** Demo account number that passes penny-drop verification */
export const ADD_INVESTOR_DEMO_BANK_ACCOUNT = "9876543210";

export type AddInvestorBankDetailsResult =
  | {
      ok: true;
      accountHolderName: string;
      bankName: string;
      branchName: string;
    }
  | { ok: false; error: string };

export type AddInvestorBankVerifyResult =
  | { ok: true }
  | { ok: false; error: string };

export function normalizeIfscInput(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
}

export async function fetchDemoBankDetails(input: {
  ifsc: string;
  accountNumber: string;
  accountType: string;
  accountHolderName: string;
}): Promise<AddInvestorBankDetailsResult> {
  const normalizedIfsc = normalizeIfscInput(input.ifsc);
  if (!IFSC_PATTERN.test(normalizedIfsc)) {
    return { ok: false, error: "Enter a valid 11-character IFSC code." };
  }

  if (!input.accountType.trim()) {
    return { ok: false, error: "Select an account type." };
  }

  const account = input.accountNumber.replace(/\D/g, "");
  if (account.length < 9) {
    return { ok: false, error: "Account number must be at least 9 digits." };
  }

  const holder = input.accountHolderName.trim();
  if (holder.length < 3) {
    return { ok: false, error: "Account holder name is unavailable. Complete PAN verification first." };
  }

  await delay(900);

  if (account !== ADD_INVESTOR_DEMO_BANK_ACCOUNT) {
    return {
      ok: false,
      error: `Could not verify this account. Demo account number: ${ADD_INVESTOR_DEMO_BANK_ACCOUNT}.`,
    };
  }

  const prefix = normalizedIfsc.slice(0, 4);
  const bankMeta = DEMO_BANK_BY_PREFIX[prefix] ?? {
    bankName: `${prefix} Bank`,
    branchName: "Main Branch",
  };

  return {
    ok: true,
    accountHolderName: holder,
    bankName: bankMeta.bankName,
    branchName: `${bankMeta.branchName} · ${normalizedIfsc.slice(-4)}`,
  };
}

export async function verifyDemoBankAccount(input: {
  ifsc: string;
  accountNumber: string;
  accountHolderName: string;
}): Promise<AddInvestorBankVerifyResult> {
  const normalizedIfsc = normalizeIfscInput(input.ifsc);
  if (!IFSC_PATTERN.test(normalizedIfsc)) {
    return { ok: false, error: "Enter a valid IFSC code before verifying." };
  }

  const account = input.accountNumber.replace(/\D/g, "");
  if (account.length < 9) {
    return { ok: false, error: "Account number must be at least 9 digits." };
  }

  await delay(900);

  if (account !== ADD_INVESTOR_DEMO_BANK_ACCOUNT) {
    return {
      ok: false,
      error: `Demo verification failed. Use account number ${ADD_INVESTOR_DEMO_BANK_ACCOUNT}.`,
    };
  }

  if (input.accountHolderName.trim().length < 3) {
    return { ok: false, error: "Account holder name does not match bank records." };
  }

  return { ok: true };
}
