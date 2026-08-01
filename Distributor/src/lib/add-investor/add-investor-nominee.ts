export const MAX_ADD_INVESTOR_NOMINEES = 3;
export const ADD_INVESTOR_MINOR_AGE_THRESHOLD = 18;

export type AddInvestorNomineeType = "minor" | "adult";
export type AddInvestorNomineeWizardStep = "details" | "contact" | "address";

export type AddInvestorNomineeCore = {
  fullName: string;
  age: string;
  relationship: string;
  sharePercent: string;
  sourceOfWealth: string;
};

export type AddInvestorNomineeContact = {
  email: string;
  mobile: string;
};

export type AddInvestorNomineeIdentity = {
  documentType: string;
  documentNumber: string;
};

export type AddInvestorNomineeGuardian = {
  name: string;
  email: string;
  mobile: string;
  documentType: string;
  documentNumber: string;
  sourceOfWealth: string;
};

export type AddInvestorNomineeAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

export type AddInvestorNomineeRecord = {
  id: string;
  type: AddInvestorNomineeType;
  core: AddInvestorNomineeCore;
  contact: AddInvestorNomineeContact;
  identity: AddInvestorNomineeIdentity;
  guardian?: AddInvestorNomineeGuardian;
  address: AddInvestorNomineeAddress;
};

export const ADD_INVESTOR_NOMINEE_RELATIONSHIPS = [
  { value: "spouse", label: "Spouse" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "brother", label: "Brother" },
  { value: "sister", label: "Sister" },
  { value: "other", label: "Other" },
] as const;

export const ADD_INVESTOR_NOMINEE_SOURCE_OF_WEALTH = [
  { value: "salary", label: "Salary / Employment" },
  { value: "business", label: "Business income" },
  { value: "investments", label: "Investments" },
  { value: "inheritance", label: "Inheritance" },
  { value: "gift", label: "Gift" },
  { value: "savings", label: "Savings" },
  { value: "other", label: "Other" },
] as const;

export const ADD_INVESTOR_NOMINEE_DOCUMENT_TYPES = [
  { value: "pan", label: "PAN" },
  { value: "aadhaar", label: "Aadhaar" },
  { value: "passport", label: "Passport" },
  { value: "driving_licence", label: "Driving licence" },
  { value: "voter_id", label: "Voter ID" },
] as const;

export const ADD_INVESTOR_NOMINEE_WIZARD_STEPS: readonly AddInvestorNomineeWizardStep[] = [
  "details",
  "contact",
  "address",
] as const;

export function createEmptyNomineeCore(): AddInvestorNomineeCore {
  return {
    fullName: "",
    age: "",
    relationship: "",
    sharePercent: "",
    sourceOfWealth: "",
  };
}

export function createEmptyNomineeContact(): AddInvestorNomineeContact {
  return {
    email: "",
    mobile: "",
  };
}

export function createEmptyNomineeIdentity(): AddInvestorNomineeIdentity {
  return {
    documentType: "",
    documentNumber: "",
  };
}

export function createEmptyNomineeGuardian(): AddInvestorNomineeGuardian {
  return {
    name: "",
    email: "",
    mobile: "",
    documentType: "",
    documentNumber: "",
    sourceOfWealth: "",
  };
}

export function createEmptyNomineeAddress(): AddInvestorNomineeAddress {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  };
}

export function createEmptyNomineeDraft(type: AddInvestorNomineeType = "adult"): Omit<AddInvestorNomineeRecord, "id"> {
  return {
    type,
    core: createEmptyNomineeCore(),
    contact: createEmptyNomineeContact(),
    identity: createEmptyNomineeIdentity(),
    address: createEmptyNomineeAddress(),
    guardian: type === "minor" ? createEmptyNomineeGuardian() : undefined,
  };
}

export function parseNomineeAge(value: string): number | null {
  const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 120) return null;
  return parsed;
}

export function getNomineeTypeFromAge(age: string): AddInvestorNomineeType {
  const parsed = parseNomineeAge(age);
  if (parsed === null) return "adult";
  return parsed < ADD_INVESTOR_MINOR_AGE_THRESHOLD ? "minor" : "adult";
}

export function normalizeNomineeAgeInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 3);
}

export function normalizeNomineeShareInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.min(100, parsed));
}

export function equalNomineeSharePercent(count: number, index: number): string {
  if (count <= 0) return "100";
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return String(index < remainder ? base + 1 : base);
}

export function redistributeEqualNomineeShares(
  nominees: AddInvestorNomineeRecord[],
): AddInvestorNomineeRecord[] {
  return nominees.map((nominee, index) => ({
    ...nominee,
    core: {
      ...nominee.core,
      sharePercent: equalNomineeSharePercent(nominees.length, index),
    },
  }));
}

export function getTotalNomineeShare(nominees: AddInvestorNomineeRecord[]): number {
  return nominees.reduce((total, nominee) => {
    const share = Number(nominee.core.sharePercent);
    return total + (Number.isFinite(share) ? share : 0);
  }, 0);
}

export function isAddInvestorNomineeAddressValid(address: AddInvestorNomineeAddress): boolean {
  return (
    address.line1.trim().length > 2 &&
    address.city.trim().length > 1 &&
    address.state.trim().length > 1 &&
    address.pincode.length === 6 &&
    address.country.trim().length > 1
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidMobile(value: string): boolean {
  return /^\d{10}$/.test(value.replace(/\D/g, ""));
}

export function isAddInvestorNomineeRecordComplete(nominee: AddInvestorNomineeRecord): boolean {
  const age = parseNomineeAge(nominee.core.age);
  if (
    nominee.core.fullName.trim().length < 2 ||
    age === null ||
    !nominee.core.relationship ||
    !nominee.core.sharePercent ||
    Number(nominee.core.sharePercent) < 1
  ) {
    return false;
  }

  if (nominee.type === "adult" && !nominee.core.sourceOfWealth) {
    return false;
  }

  if (nominee.type === "adult") {
    if (
      !isValidEmail(nominee.contact.email) ||
      !isValidMobile(nominee.contact.mobile) ||
      !nominee.identity.documentType ||
      nominee.identity.documentNumber.trim().length < 3
    ) {
      return false;
    }
  }

  if (nominee.type === "minor") {
    const guardian = nominee.guardian;
    if (
      !guardian ||
      guardian.name.trim().length < 2 ||
      !isValidEmail(guardian.email) ||
      !isValidMobile(guardian.mobile) ||
      !guardian.documentType ||
      guardian.documentNumber.trim().length < 3 ||
      !guardian.sourceOfWealth
    ) {
      return false;
    }
  }

  return isAddInvestorNomineeAddressValid(nominee.address);
}

export function areAddInvestorNomineesValid(nominees: AddInvestorNomineeRecord[]): boolean {
  if (nominees.length === 0) {
    return true;
  }
  if (nominees.length > MAX_ADD_INVESTOR_NOMINEES) {
    return false;
  }
  if (getTotalNomineeShare(nominees) !== 100) {
    return false;
  }
  return nominees.every(isAddInvestorNomineeRecordComplete);
}

export function formatAddInvestorNomineeSummary(nominees: AddInvestorNomineeRecord[]): string {
  if (nominees.length === 0) return "None added";
  return nominees
    .map(
      (nominee) =>
        `${nominee.core.fullName} · ${nominee.core.relationship} · ${nominee.core.sharePercent}%`,
    )
    .join(" · ");
}

export function relationshipLabel(value: string): string {
  return ADD_INVESTOR_NOMINEE_RELATIONSHIPS.find((item) => item.value === value)?.label ?? value;
}
