import { splitPersonFullName } from "@/features/kyc/lib/kyc-name-validation";
import type { KycPanDraft } from "@/features/kyc/lib/kyc-api";
import {
  createEmptyAddressForm,
  type KycAddressFormValue,
} from "@/features/kyc/lib/kyc-address";
import {
  createEmptyBankForm,
  normalizeAccountNumber,
  normalizeIfscCode,
  type KycBankFormValue,
} from "@/features/kyc/lib/kyc-bank";
import { resolveStateOption } from "@/features/kyc/lib/kyc-digilocker-prefill";
import { INDIAN_STATES } from "@/features/kyc/lib/indian-states";
import type { ZtoReviewFields } from "@/features/kyc/lib/zto-types";

const PINCODE_IN_TEXT = /\b(\d{6})\b/;

/** Pull the first 6-digit Indian pincode embedded in free-text address lines. */
export function extractIndianPincode(...texts: (string | null | undefined)[]): string {
  for (const text of texts) {
    const value = text?.trim() ?? "";
    if (!value) continue;
    const match = value.match(PINCODE_IN_TEXT);
    if (match) return match[1];
  }
  return "";
}

function stripPincodeFromLine(line: string, pincode: string): string {
  if (!line.trim() || !pincode) return line.trim();
  const escaped = pincode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return line
    .replace(new RegExp(`[,\\s-]*${escaped}\\s*$`), "")
    .replace(new RegExp(`\\b${escaped}\\b`), "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePincodeField(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 6 ? digits : "";
}

/**
 * Maps the user-approved ZTO snapshot to PAN-step input seed values.
 *
 * UI-only seed: never persisted to the KYC journey and never marks anything verified.
 * Returns null when there is nothing useful to seed.
 */
export function mapApprovedZtoToPanPrefill(
  approved: ZtoReviewFields | null | undefined,
): KycPanDraft | null {
  if (!approved) return null;
  const panNumber = approved.pan?.trim().toUpperCase() ?? "";
  const dateOfBirth = approved.date_of_birth?.trim() ?? "";
  const { firstName, middleName, lastName } = splitPersonFullName(approved.name ?? "");
  if (!panNumber && !dateOfBirth && !firstName) return null;
  return { panNumber, dateOfBirth, firstName, middleName, lastName };
}

/**
 * Maps the user-approved ZTO snapshot to bank-step input seed values.
 * UI-only seed — never persisted until the user verifies the bank step.
 */
export function mapApprovedZtoToBankPrefill(
  approved: ZtoReviewFields | null | undefined,
): KycBankFormValue | null {
  if (!approved) return null;
  const accountNumber = normalizeAccountNumber(approved.bank_account_number ?? "");
  const ifscCode = normalizeIfscCode(approved.ifsc_code ?? "");
  if (!accountNumber && !ifscCode) return null;
  return {
    ...createEmptyBankForm(),
    accountNumber,
    ifscCode,
  };
}

/**
 * Maps the user-approved ZTO snapshot to address-step input seed values.
 * UI-only seed — never persisted until the user saves the address step.
 */
export function mapApprovedZtoToAddressPrefill(
  approved: ZtoReviewFields | null | undefined,
): KycAddressFormValue | null {
  if (!approved) return null;

  let line1 = approved.address_line_1?.trim() ?? "";
  const line2 = approved.address_line_2?.trim() ?? "";
  const legacyLine = approved.address_line?.trim() ?? "";
  if (!line1 && legacyLine) {
    line1 = legacyLine;
  }

  let pincode = normalizePincodeField(approved.pincode);
  if (!pincode) {
    pincode = extractIndianPincode(line1, legacyLine, approved.address_line_1);
  }
  if (pincode) {
    line1 = stripPincodeFromLine(line1, pincode);
  }

  let city = approved.city?.trim() ?? "";
  let state = approved.state?.trim() ?? "";
  if (state) {
    state = resolveStateOption(state, [...INDIAN_STATES]);
  }

  if (!line1 && !line2 && !city && !state && !pincode) return null;

  const empty = createEmptyAddressForm();
  return {
    ...empty,
    permanent: {
      ...empty.permanent,
      line1,
      line2,
      city,
      state,
      pincode,
    },
    sameAsPermanent: true,
  };
}

export function permanentAddressIsEmpty(value: KycAddressFormValue): boolean {
  const permanent = value.permanent;
  return (
    !permanent.line1.trim() &&
    !permanent.line2.trim() &&
    !permanent.city.trim() &&
    !permanent.state.trim() &&
    !permanent.pincode.trim()
  );
}
