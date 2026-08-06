import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ClipboardCheck,
  FilePenLine,
  Home,
  Landmark,
  PenLine,
  ScanFace,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

export type AddInvestorStepId =
  | "onboarding"
  | "pan"
  | "digilocker"
  | "signature-upload"
  | "address"
  | "personal-info"
  | "nominee"
  | "bank"
  | "esign"
  | "review";

export type AddInvestorJourneyPhase = "onboarding" | "compliance";

export type AddInvestorJourneyStep = {
  id: AddInvestorStepId;
  label: string;
  description: string;
  icon: LucideIcon;
  phase: AddInvestorJourneyPhase;
  optional?: boolean;
};

const ONBOARDING_STEP: AddInvestorJourneyStep = {
  id: "onboarding",
  label: "Onboarding",
  description: "Email, mobile & MFA",
  icon: ShieldCheck,
  phase: "onboarding",
};

const PAN_STEP: AddInvestorJourneyStep = {
  id: "pan",
  label: "PAN card",
  description: "Verify & fetch name",
  icon: ScanFace,
  phase: "compliance",
};

const DIGILOCKER_STEP: AddInvestorJourneyStep = {
  id: "digilocker",
  label: "DigiLocker",
  description: "Aadhaar KYC fetch",
  icon: BadgeCheck,
  phase: "compliance",
};

const SIGNATURE_STEP: AddInvestorJourneyStep = {
  id: "signature-upload",
  label: "Signature",
  description: "Upload wet signature",
  icon: PenLine,
  phase: "compliance",
};

const ADDRESS_STEP: AddInvestorJourneyStep = {
  id: "address",
  label: "Address",
  description: "Permanent & correspondence",
  icon: Home,
  phase: "compliance",
};

const PERSONAL_INFO_STEP: AddInvestorJourneyStep = {
  id: "personal-info",
  label: "Personal info",
  description: "Compliance details",
  icon: UserRound,
  phase: "compliance",
};

const NOMINEE_STEP: AddInvestorJourneyStep = {
  id: "nominee",
  label: "Nominee",
  description: "Optional nomination",
  icon: Users,
  phase: "compliance",
  optional: true,
};

const BANK_STEP: AddInvestorJourneyStep = {
  id: "bank",
  label: "Bank",
  description: "Payout account",
  icon: Landmark,
  phase: "compliance",
};

const ESIGN_STEP: AddInvestorJourneyStep = {
  id: "esign",
  label: "E-sign",
  description: "Aadhaar OTP sign",
  icon: FilePenLine,
  phase: "compliance",
};

const REVIEW_STEP: AddInvestorJourneyStep = {
  id: "review",
  label: "Review",
  description: "Review your details",
  icon: ClipboardCheck,
  phase: "compliance",
};

const COMPLIANCE_TAIL_NEW_TO_KYC: AddInvestorJourneyStep[] = [
  NOMINEE_STEP,
  BANK_STEP,
  SIGNATURE_STEP,
  ESIGN_STEP,
  REVIEW_STEP,
];

/** New-to-KYC: DigiLocker first; signature upload after bank; e-sign before review. */
const NEW_TO_KYC_COMPLIANCE: AddInvestorJourneyStep[] = [
  PAN_STEP,
  DIGILOCKER_STEP,
  ADDRESS_STEP,
  PERSONAL_INFO_STEP,
  ...COMPLIANCE_TAIL_NEW_TO_KYC,
];

/** KRA registered: skip DigiLocker, signature upload, and e-sign. */
const KRA_COMPLIANCE: AddInvestorJourneyStep[] = [
  PAN_STEP,
  ADDRESS_STEP,
  PERSONAL_INFO_STEP,
  NOMINEE_STEP,
  BANK_STEP,
  REVIEW_STEP,
];

/** @param requiresDigilocker true when investor is new to KYC (not KRA compliant). */
export function buildAddInvestorJourneySteps(requiresDigilocker: boolean): AddInvestorJourneyStep[] {
  const complianceSteps = requiresDigilocker ? NEW_TO_KYC_COMPLIANCE : KRA_COMPLIANCE;
  return [ONBOARDING_STEP, ...complianceSteps];
}

export const ADD_INVESTOR_JOURNEY_PHASE_LABEL: Record<AddInvestorJourneyPhase, string> = {
  onboarding: "Onboarding",
  compliance: "Compliance",
};

export function addInvestorStepIndex(
  steps: AddInvestorJourneyStep[],
  stepId: AddInvestorStepId,
): number {
  return steps.findIndex((item) => item.id === stepId);
}

export type AddInvestorAddressFields = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

export type AddInvestorAddressDraft = {
  permanent: AddInvestorAddressFields;
  correspondence: AddInvestorAddressFields;
  correspondenceSame: boolean;
};

export type AddInvestorPersonalDraft = {
  fathersName: string;
  gender: string;
  maritalStatus: string;
  occupation: string;
  incomeSlab: string;
  pepExposed: string;
  placeOfBirth: string;
  countryOfOrigin: string;
};

export type AddInvestorBankDraft = {
  accountHolderName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountType: string;
  ifsc: string;
  accountVerified: boolean;
};

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function isValidAddInvestorIfsc(value: string): boolean {
  return IFSC_PATTERN.test(value.trim().toUpperCase());
}

export function isAddInvestorBankDraftValid(bank: AddInvestorBankDraft): boolean {
  const account = bank.accountNumber.replace(/\D/g, "");
  return (
    bank.accountVerified &&
    Boolean(bank.accountType) &&
    bank.accountHolderName.trim().length >= 3 &&
    bank.bankName.trim().length >= 2 &&
    bank.branchName.trim().length >= 2 &&
    account.length >= 9 &&
    isValidAddInvestorIfsc(bank.ifsc)
  );
}

export const ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS = [
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
  { value: "nre", label: "NRE" },
  { value: "nro", label: "NRO" },
] as const;

export type AddInvestorPanName = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  panCategory: string;
};

export type AddInvestorReadiness = {
  code: string;
  label: string;
  hint: string;
};

export function emptyAddressFields(): AddInvestorAddressFields {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "india",
  };
}

export function getAddInvestorCountryLabel(country: string): string {
  const option = ADD_INVESTOR_COUNTRY_OPTIONS.find(
    (item) => item.value === country || item.label === country,
  );
  return option?.label ?? country;
}

export function isAddInvestorAddressFieldsValid(fields: AddInvestorAddressFields): boolean {
  return (
    fields.line1.trim().length > 2 &&
    fields.city.trim().length > 1 &&
    fields.state.trim().length > 1 &&
    fields.pincode.length === 6 &&
    fields.country.trim().length > 0
  );
}

export function emptyAddressDraft(): AddInvestorAddressDraft {
  const fields = emptyAddressFields();
  return {
    permanent: { ...fields },
    correspondence: { ...fields },
    correspondenceSame: true,
  };
}

export function emptyPersonalDraft(): AddInvestorPersonalDraft {
  return {
    fathersName: "",
    gender: "",
    maritalStatus: "",
    occupation: "",
    incomeSlab: "",
    pepExposed: "no",
    placeOfBirth: "",
    countryOfOrigin: "",
  };
}

export function normalizeAddInvestorPersonalDraft(
  personal: Partial<AddInvestorPersonalDraft> | null | undefined,
): AddInvestorPersonalDraft {
  const defaults = emptyPersonalDraft();
  return {
    fathersName: personal?.fathersName ?? defaults.fathersName,
    gender: personal?.gender ?? defaults.gender,
    maritalStatus: personal?.maritalStatus ?? defaults.maritalStatus,
    occupation: personal?.occupation ?? defaults.occupation,
    incomeSlab: personal?.incomeSlab ?? defaults.incomeSlab,
    pepExposed: personal?.pepExposed ?? defaults.pepExposed,
    placeOfBirth: personal?.placeOfBirth ?? defaults.placeOfBirth,
    countryOfOrigin: personal?.countryOfOrigin ?? defaults.countryOfOrigin,
  };
}

export function isAddInvestorPersonalDraftValid(personal: AddInvestorPersonalDraft): boolean {
  const normalized = normalizeAddInvestorPersonalDraft(personal);
  return (
    normalized.fathersName.trim().length > 1 &&
    Boolean(normalized.gender) &&
    Boolean(normalized.maritalStatus) &&
    Boolean(normalized.occupation) &&
    Boolean(normalized.incomeSlab) &&
    Boolean(normalized.pepExposed) &&
    normalized.placeOfBirth.trim().length > 1
  );
}

export function emptyBankDraft(): AddInvestorBankDraft {
  return {
    accountHolderName: "",
    bankName: "",
    branchName: "",
    accountNumber: "",
    accountType: "",
    ifsc: "",
    accountVerified: false,
  };
}

export function isValidSixDigitOtp(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

export const ADD_INVESTOR_COUNTRY_OPTIONS = [
  { value: "india", label: "India" },
  { value: "united_states", label: "United States" },
  { value: "united_kingdom", label: "United Kingdom" },
  { value: "canada", label: "Canada" },
  { value: "australia", label: "Australia" },
  { value: "singapore", label: "Singapore" },
  { value: "uae", label: "United Arab Emirates" },
  { value: "germany", label: "Germany" },
  { value: "france", label: "France" },
  { value: "japan", label: "Japan" },
  { value: "china", label: "China" },
  { value: "nepal", label: "Nepal" },
  { value: "bangladesh", label: "Bangladesh" },
  { value: "sri_lanka", label: "Sri Lanka" },
  { value: "pakistan", label: "Pakistan" },
  { value: "other", label: "Other" },
] as const;

export const ADD_INVESTOR_PERSONAL_OPTIONS = {
  gender: [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ],
  maritalStatus: [
    { value: "single", label: "Single" },
    { value: "married", label: "Married" },
  ],
  occupation: [
    { value: "salaried", label: "Salaried" },
    { value: "business", label: "Business" },
    { value: "professional", label: "Professional" },
    { value: "retired", label: "Retired" },
    { value: "student", label: "Student" },
  ],
  incomeSlab: [
    { value: "below_1l", label: "Below ₹1L" },
    { value: "1l_5l", label: "₹1L – ₹5L" },
    { value: "5l_10l", label: "₹5L – ₹10L" },
    { value: "10l_25l", label: "₹10L – ₹25L" },
    { value: "above_25l", label: "Above ₹25L" },
  ],
  pepExposed: [
    { value: "no", label: "Not PEP" },
    { value: "yes", label: "PEP / related" },
  ],
  countryOfOrigin: [...ADD_INVESTOR_COUNTRY_OPTIONS],
  nomineeRelation: [
    { value: "spouse", label: "Spouse" },
    { value: "child", label: "Child" },
    { value: "parent", label: "Parent" },
    { value: "other", label: "Other" },
  ],
} as const;
