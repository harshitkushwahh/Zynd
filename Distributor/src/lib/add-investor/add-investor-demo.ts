import type {
  AddInvestorAddressDraft,
  AddInvestorPanName,
  AddInvestorReadiness,
} from "@/lib/add-investor/add-investor-journey";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** K in 4th character of PAN suffix pattern → demo KRA-registered investor */
const KRA_DEMO_PAN_PATTERN = /^[A-Z]{4}K[0-9]{4}[A-Z]$/;

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
    return { ok: false, error: "Enter a valid 10-character PAN (e.g. ABCPK1234A)." };
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
        hint: "Investor is compliant with KRA. Skip DigiLocker and capture address manually.",
      }
    : {
        code: "new_to_kyc",
        label: "New to KYC",
        hint: "Full KYC required. Continue with DigiLocker to fetch Aadhaar address.",
      };

  return { ok: true, panName, kycAlreadyRegistered, readiness };
}

export const DIGILOCKER_PREFILL_ADDRESS: AddInvestorAddressDraft = {
  line1: "Flat 402, Zynd Heights",
  line2: "12 MG Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
  country: "India",
  correspondenceSame: true,
};

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
