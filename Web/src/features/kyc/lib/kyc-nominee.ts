import { DEFAULT_KYC_COUNTRY } from "@/features/kyc/lib/indian-states";

export const MAX_KYC_NOMINEES = 3;
export const MINOR_AGE_THRESHOLD = 18;

export type KycNomineeType = "minor" | "individual";
export type KycNomineeWizardStep = "basic" | "contact" | "address";

export type KycNomineeCore = {
  fullName: string;
  relationship: string;
  sourceOfWealth: string;
  dateOfBirth: string;
  sharePercent: string;
};

export type KycNomineeIdentity = {
  documentType: string;
  documentNumber: string;
};

export type KycNomineeContact = {
  email: string;
  mobile: string;
};

export type KycNomineeAddress = {
  line1: string;
  line2: string;
  city: string;
  pincode: string;
  country: string;
};

export type KycNomineeGuardian = {
  name: string;
  sourceOfWealth: string;
  documentType: string;
  documentNumber: string;
  email: string;
  mobile: string;
};

export type KycNomineeRecord = {
  id: string;
  type: KycNomineeType;
  core: KycNomineeCore;
  identity: KycNomineeIdentity;
  contact: KycNomineeContact;
  address: KycNomineeAddress;
  guardian?: KycNomineeGuardian;
};

export const KYC_NOMINEE_RELATIONSHIPS = [
  "Spouse",
  "Son",
  "Daughter",
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Other",
] as const;

export const KYC_NOMINEE_SOURCE_OF_WEALTH = [
  "Salary / Employment",
  "Business income",
  "Investments",
  "Inheritance",
  "Gift",
  "Savings",
  "Other",
] as const;

export const KYC_NOMINEE_DOCUMENT_TYPES = [
  "PAN",
  "Aadhaar",
  "Passport",
  "Driving licence",
  "Voter ID",
] as const;

export const KYC_NOMINEE_WIZARD_STEPS: readonly KycNomineeWizardStep[] = [
  "basic",
  "contact",
  "address",
] as const;

export function createEmptyNomineeCore(): KycNomineeCore {
  return {
    fullName: "",
    relationship: "",
    sourceOfWealth: "",
    dateOfBirth: "",
    sharePercent: "",
  };
}

export function createEmptyNomineeIdentity(): KycNomineeIdentity {
  return {
    documentType: "",
    documentNumber: "",
  };
}

export function createEmptyNomineeContact(): KycNomineeContact {
  return {
    email: "",
    mobile: "",
  };
}

export function createEmptyNomineeAddress(): KycNomineeAddress {
  return {
    line1: "",
    line2: "",
    city: "",
    pincode: "",
    country: DEFAULT_KYC_COUNTRY,
  };
}

export function createEmptyNomineeGuardian(): KycNomineeGuardian {
  return {
    name: "",
    sourceOfWealth: "",
    documentType: "",
    documentNumber: "",
    email: "",
    mobile: "",
  };
}

export function createEmptyNomineeDraft(type: KycNomineeType): Omit<KycNomineeRecord, "id"> {
  return {
    type,
    core: createEmptyNomineeCore(),
    identity: createEmptyNomineeIdentity(),
    contact: createEmptyNomineeContact(),
    address: createEmptyNomineeAddress(),
    guardian: type === "minor" ? createEmptyNomineeGuardian() : undefined,
  };
}

export function parseNomineeDob(value: string) {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatNomineeDobForDateInput(value: string) {
  const parsed = parseNomineeDob(value);
  if (!parsed) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatNomineeDobInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function isMinorNomineeDob(dateOfBirth: string) {
  const parsed = parseNomineeDob(dateOfBirth);
  if (!parsed) return false;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age < MINOR_AGE_THRESHOLD;
}

export function getNomineeTypeFromDob(dateOfBirth: string): KycNomineeType {
  return isMinorNomineeDob(dateOfBirth) ? "minor" : "individual";
}

export function getTotalNomineeShare(nominees: KycNomineeRecord[]) {
  return nominees.reduce((total, nominee) => {
    const share = Number(nominee.core.sharePercent);
    return total + (Number.isFinite(share) ? share : 0);
  }, 0);
}

export function normalizeNomineeSharePercentInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return "";

  return String(Math.min(100, parsed));
}

function nomineeSnapshotForCompare(record: Omit<KycNomineeRecord, "id"> | KycNomineeRecord) {
  const { id: _id, ...snapshot } = record as KycNomineeRecord;
  return snapshot;
}

function hasMeaningfulNomineeDraftContent(snapshot: Omit<KycNomineeRecord, "id">) {
  const { core, identity, contact, address, guardian } = snapshot;

  if (
    core.fullName.trim() ||
    core.relationship.trim() ||
    core.sourceOfWealth.trim() ||
    core.dateOfBirth.trim() ||
    core.sharePercent.trim()
  ) {
    return true;
  }

  if (identity.documentType.trim() || identity.documentNumber.trim()) {
    return true;
  }

  if (contact.email.trim() || contact.mobile.trim()) {
    return true;
  }

  if (
    address.line1.trim() ||
    address.line2.trim() ||
    address.city.trim() ||
    address.pincode.trim()
  ) {
    return true;
  }

  if (guardian) {
    if (
      guardian.name.trim() ||
      guardian.sourceOfWealth.trim() ||
      guardian.documentType.trim() ||
      guardian.documentNumber.trim() ||
      guardian.email.trim() ||
      guardian.mobile.trim()
    ) {
      return true;
    }
  }

  return false;
}

export function isNomineeWizardDirty(
  snapshot: Omit<KycNomineeRecord, "id">,
  editingNominee?: KycNomineeRecord,
) {
  if (editingNominee) {
    return (
      JSON.stringify(nomineeSnapshotForCompare(snapshot)) !==
      JSON.stringify(nomineeSnapshotForCompare(editingNominee))
    );
  }

  return hasMeaningfulNomineeDraftContent(snapshot);
}
