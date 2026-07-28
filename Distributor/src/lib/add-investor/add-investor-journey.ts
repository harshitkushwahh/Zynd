import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ClipboardCheck,
  Fingerprint,
  Home,
  Mail,
  Phone,
  ScanFace,
  UserRound,
} from "lucide-react";

export type AddInvestorStepId =
  | "email"
  | "mobile"
  | "mfa"
  | "pan"
  | "digilocker"
  | "address"
  | "personal-info"
  | "review";

export type AddInvestorJourneyStep = {
  id: AddInvestorStepId;
  label: string;
  description: string;
  icon: LucideIcon;
  phase: "account" | "kyc";
};

const ACCOUNT_STEPS: AddInvestorJourneyStep[] = [
  {
    id: "email",
    label: "Email verification",
    description: "Email & inbox OTP",
    icon: Mail,
    phase: "account",
  },
  {
    id: "mobile",
    label: "Mobile verification",
    description: "Number & SMS OTP",
    icon: Phone,
    phase: "account",
  },
  {
    id: "mfa",
    label: "Authenticator",
    description: "MFA app setup",
    icon: Fingerprint,
    phase: "account",
  },
];

const KYC_STEPS_BASE: AddInvestorJourneyStep[] = [
  {
    id: "pan",
    label: "PAN card",
    description: "Verify & fetch name",
    icon: ScanFace,
    phase: "kyc",
  },
  {
    id: "digilocker",
    label: "DigiLocker",
    description: "Aadhaar KYC fetch",
    icon: BadgeCheck,
    phase: "kyc",
  },
  {
    id: "address",
    label: "Address",
    description: "Permanent & correspondence",
    icon: Home,
    phase: "kyc",
  },
  {
    id: "personal-info",
    label: "Personal info",
    description: "Compliance details",
    icon: UserRound,
    phase: "kyc",
  },
  {
    id: "review",
    label: "Review",
    description: "Confirm & invite",
    icon: ClipboardCheck,
    phase: "kyc",
  },
];

export function buildAddInvestorJourneySteps(requiresDigilocker: boolean): AddInvestorJourneyStep[] {
  const kycSteps = requiresDigilocker
    ? KYC_STEPS_BASE
    : KYC_STEPS_BASE.filter((step) => step.id !== "digilocker");
  return [...ACCOUNT_STEPS, ...kycSteps];
}

export function addInvestorStepIndex(
  steps: AddInvestorJourneyStep[],
  stepId: AddInvestorStepId,
): number {
  return steps.findIndex((item) => item.id === stepId);
}

export type AddInvestorAddressDraft = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  correspondenceSame: boolean;
};

export type AddInvestorPersonalDraft = {
  gender: string;
  maritalStatus: string;
  occupation: string;
  incomeSlab: string;
  pepExposed: string;
  placeOfBirth: string;
};

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

export function emptyAddressDraft(): AddInvestorAddressDraft {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    correspondenceSame: true,
  };
}

export function emptyPersonalDraft(): AddInvestorPersonalDraft {
  return {
    gender: "",
    maritalStatus: "",
    occupation: "",
    incomeSlab: "",
    pepExposed: "no",
    placeOfBirth: "",
  };
}

export const ADD_INVESTOR_DEMO_OTP = "123456";

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
} as const;
