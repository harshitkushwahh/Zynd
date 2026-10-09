import type {
  InvestorSettingsStateResponse,
  KycBootstrapResponse,
  KycPanDraft,
} from "@/features/kyc/lib/kyc-api";
import type { KycAddressFields, KycAddressFormValue } from "@/features/kyc/lib/kyc-address";
import type { KycNomineeRecord } from "@/features/kyc/lib/kyc-nominee";
import type { KycPersonalInfoValue } from "@/features/kyc/lib/kyc-personal-info";
import { resolvePanDisplay } from "@/features/kyc/lib/kyc-sensitive-display";
import { formatSettingsKycProfile } from "@/features/kyc/lib/settings-kyc-display";
import { normalizeFathersNameFromDigilocker } from "@/features/kyc/lib/kyc-name-validation";

export type SettingsKycAddress = {
  permanent: string;
  correspondence: string;
  sameAsPermanent: boolean;
  verified: boolean;
};

export type SettingsKycBank = {
  accountHolderName: string;
  accountNumberMasked: string;
  accountType: string;
  ifscCode: string;
  bankName: string;
  branch: string;
  verified: boolean;
};

export type SettingsKycProfile = {
  panMasked: string | null;
  panLast4: string | null;
  panVerified: boolean;
  kycVerified: boolean;
  legalFullName: string | null;
  personalInfo: KycPersonalInfoValue | null;
  personalInfoRaw: KycPersonalInfoValue | null;
  address: SettingsKycAddress | null;
  bank: SettingsKycBank | null;
  canEditProfile: boolean;
  canAddNominee: boolean;
  nominees: KycNomineeRecord[];
  maxNominees: number;
};

function asNomineeRecords(raw: unknown[] | null | undefined): KycNomineeRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is KycNomineeRecord => {
    if (!item || typeof item !== "object") return false;
    const value = item as Record<string, unknown>;
    return typeof value.id === "string" && Boolean(value.core) && typeof value.core === "object";
  });
}

export function formatKycPanFullName(panDraft: KycPanDraft | null | undefined): string | null {
  if (!panDraft) return null;
  const structured = [panDraft.firstName, panDraft.middleName, panDraft.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (structured) return structured;
  const fullName = panDraft.fullName?.trim();
  return fullName || null;
}

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
  const fathersRaw = String(raw.fathersName ?? "");
  return {
    fathersName: fathersRaw ? normalizeFathersNameFromDigilocker(fathersRaw) : fathersRaw,
    gender: String(raw.gender ?? ""),
    incomeSlab: String(raw.incomeSlab ?? ""),
    occupation: String(raw.occupation ?? ""),
    maritalStatus: String(raw.maritalStatus ?? ""),
    spouseName: String(raw.spouseName ?? ""),
    pepExposed: String(raw.pepExposed ?? ""),
    placeOfBirth: String(raw.placeOfBirth ?? ""),
    nationality: String(raw.nationality ?? ""),
    maritalStatusLocked: Boolean(raw.maritalStatusLocked),
  };
}

function mapBankDraft(raw: Record<string, unknown> | null | undefined): SettingsKycBank | null {
  if (!raw) return null;
  const accountNumberMasked = String(raw.accountNumberMasked ?? "").trim();
  const accountNumberLast4 = String(raw.accountNumberLast4 ?? "").trim();
  const legacyAccountNumber = String(raw.accountNumber ?? "").trim();
  const masked =
    accountNumberMasked ||
    (accountNumberLast4 ? `•••• ${accountNumberLast4}` : "") ||
    (legacyAccountNumber.length > 4 ? `•••• ${legacyAccountNumber.slice(-4)}` : legacyAccountNumber);
  if (!masked) return null;
  return {
    accountHolderName: String(raw.accountHolderName ?? ""),
    accountNumberMasked: masked,
    accountType: String(raw.accountType ?? ""),
    ifscCode: String(raw.ifscCode ?? ""),
    bankName: String(raw.bankName ?? ""),
    branch: String(raw.branch ?? ""),
    verified: false,
  };
}

export function mapBootstrapToKycProfile(
  bootstrap: KycBootstrapResponse | null,
  investorSettings?: InvestorSettingsStateResponse | null,
): SettingsKycProfile {
  const contact = mapContactDraft(bootstrap?.contact_draft ?? null);
  const bank = mapBankDraft(bootstrap?.bank_draft ?? null);
  const kycVerified = bootstrap?.step_statuses?.overall === "completed";
  const personalInfoRaw = mapPersonalDraft(bootstrap?.personal_draft ?? null);
  const nominees = asNomineeRecords(investorSettings?.nominees ?? bootstrap?.nominee_draft);

  return formatSettingsKycProfile({
    panMasked: resolvePanDisplay(bootstrap?.pan_draft ?? null),
    panLast4: bootstrap?.pan_draft?.panLast4?.trim().toUpperCase() || null,
    panVerified: kycVerified && bootstrap?.pan_verification_status === "verified",
    kycVerified,
    legalFullName: formatKycPanFullName(bootstrap?.pan_draft ?? null),
    personalInfo: personalInfoRaw,
    personalInfoRaw,
    address: contact
      ? {
          permanent: formatAddressBlock(contact.permanent),
          correspondence: formatAddressBlock(
            contact.sameAsPermanent ? contact.permanent : contact.correspondence,
          ),
          sameAsPermanent: contact.sameAsPermanent,
          verified: kycVerified && bootstrap?.external_kyc_status === "returned_success",
        }
      : null,
    bank: bank
      ? {
          ...bank,
          verified: kycVerified && bootstrap?.bank_verification_status === "verified",
        }
      : null,
    canEditProfile: Boolean(investorSettings?.can_edit_profile),
    canAddNominee: Boolean(investorSettings?.can_add_nominee),
    nominees,
    maxNominees: investorSettings?.max_nominees ?? 3,
  });
}
