import type { KycBootstrapResponse } from "@/features/kyc/lib/kyc-api";
import type { KycAddressFields, KycAddressFormValue } from "@/features/kyc/lib/kyc-address";
import type { KycPersonalInfoValue } from "@/features/kyc/lib/kyc-personal-info";
import { formatSettingsKycProfile } from "@/features/kyc/lib/settings-kyc-display";

export type SettingsKycAddress = {
  permanent: string;
  correspondence: string;
  sameAsPermanent: boolean;
  verified: boolean;
};

export type SettingsKycBank = {
  accountHolderName: string;
  accountNumber: string;
  accountType: string;
  ifscCode: string;
  bankName: string;
  branch: string;
  verified: boolean;
};

export type SettingsKycProfile = {
  panNumber: string | null;
  panVerified: boolean;
  personalInfo: KycPersonalInfoValue | null;
  address: SettingsKycAddress | null;
  bank: SettingsKycBank | null;
};

function asAddressFields(raw: unknown): KycAddressFields | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  return {
    line1: String(value.line1 ?? ""),
    line2: String(value.line2 ?? ""),
    city: String(value.city ?? ""),
    state: String(value.state ?? ""),
    pincode: String(value.pincode ?? ""),
    country: String(value.country ?? ""),
  };
}

export function formatAddressBlock(address: KycAddressFields): string {
  return [address.line1, address.line2, address.city, address.state, address.pincode, address.country]
    .filter(Boolean)
    .join(", ");
}

function mapContactDraft(raw: Record<string, unknown> | null | undefined): KycAddressFormValue | null {
  if (!raw) return null;
  const permanent = asAddressFields(raw.permanent);
  if (!permanent) return null;
  const correspondence = asAddressFields(raw.correspondence) ?? permanent;
  return {
    permanent,
    correspondence,
    sameAsPermanent: Boolean(raw.sameAsPermanent),
  };
}

function mapPersonalDraft(raw: Record<string, unknown> | null | undefined): KycPersonalInfoValue | null {
  if (!raw) return null;
  return {
    fathersName: String(raw.fathersName ?? ""),
    gender: String(raw.gender ?? ""),
    incomeSlab: String(raw.incomeSlab ?? ""),
    occupation: String(raw.occupation ?? ""),
    maritalStatus: String(raw.maritalStatus ?? ""),
    pepExposed: String(raw.pepExposed ?? ""),
    placeOfBirth: String(raw.placeOfBirth ?? ""),
    nationality: String(raw.nationality ?? ""),
  };
}

function mapBankDraft(raw: Record<string, unknown> | null | undefined): SettingsKycBank | null {
  if (!raw) return null;
  const accountNumber = String(raw.accountNumber ?? "").trim();
  if (!accountNumber) return null;
  return {
    accountHolderName: String(raw.accountHolderName ?? ""),
    accountNumber,
    accountType: String(raw.accountType ?? ""),
    ifscCode: String(raw.ifscCode ?? ""),
    bankName: String(raw.bankName ?? ""),
    branch: String(raw.branch ?? ""),
    verified: false,
  };
}

export function mapBootstrapToKycProfile(
  bootstrap: KycBootstrapResponse | null,
): SettingsKycProfile {
  const contact = mapContactDraft(bootstrap?.contact_draft ?? null);
  const bank = mapBankDraft(bootstrap?.bank_draft ?? null);

  return formatSettingsKycProfile({
    panNumber: bootstrap?.pan_draft?.panNumber ?? null,
    panVerified: bootstrap?.pan_verification_status === "verified",
    personalInfo: mapPersonalDraft(bootstrap?.personal_draft ?? null),
    address: contact
      ? {
          permanent: formatAddressBlock(contact.permanent),
          correspondence: formatAddressBlock(
            contact.sameAsPermanent ? contact.permanent : contact.correspondence,
          ),
          sameAsPermanent: contact.sameAsPermanent,
          verified: Boolean(
            bootstrap?.external_kyc_status === "returned_success" || contact.permanent.line1,
          ),
        }
      : null,
    bank: bank
      ? {
          ...bank,
          verified: bootstrap?.bank_verification_status === "verified",
        }
      : null,
  });
}

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return `•••• •••• ${accountNumber.slice(-4)}`;
}
