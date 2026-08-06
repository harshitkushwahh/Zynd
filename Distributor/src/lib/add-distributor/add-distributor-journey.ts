import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  Camera,
  FileUp,
  Home,
  Landmark,
  Mail,
  Phone,
  ScanFace,
  UserRound,
} from "lucide-react";

import type { AddInvestorWizardProgressStep } from "@/components/add-investor/add-investor-wizard-progress";

export type AddDistributorStepId =
  | "email"
  | "mobile"
  | "pan"
  | "name"
  | "bank"
  | "address"
  | "documents"
  | "photo"
  | "review";

export type AddDistributorJourneyStep = {
  id: AddDistributorStepId;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const ADD_DISTRIBUTOR_JOURNEY_STEPS: AddDistributorJourneyStep[] = [
  {
    id: "email",
    label: "Email",
    description: "Work email & OTP",
    icon: Mail,
  },
  {
    id: "mobile",
    label: "Mobile",
    description: "Number & SMS OTP",
    icon: Phone,
  },
  {
    id: "pan",
    label: "PAN",
    description: "Income tax ID",
    icon: ScanFace,
  },
  {
    id: "name",
    label: "Details",
    description: "Legal name",
    icon: UserRound,
  },
  {
    id: "bank",
    label: "Bank",
    description: "Payout settlement",
    icon: Landmark,
  },
  {
    id: "address",
    label: "Address",
    description: "Registered office",
    icon: Home,
  },
  {
    id: "documents",
    label: "Documents",
    description: "PAN & Aadhaar",
    icon: FileUp,
  },
  {
    id: "photo",
    label: "Photo",
    description: "Profile picture",
    icon: Camera,
  },
  {
    id: "review",
    label: "Review",
    description: "Submit to branch",
    icon: ClipboardCheck,
  },
];

export function addDistributorStepIndex(stepId: AddDistributorStepId): number {
  return ADD_DISTRIBUTOR_JOURNEY_STEPS.findIndex((item) => item.id === stepId);
}

export function addDistributorWizardProgressSteps(): AddInvestorWizardProgressStep[] {
  return ADD_DISTRIBUTOR_JOURNEY_STEPS.map(({ id, label, icon }) => ({
    id,
    label,
    icon,
  }));
}

export type AddDistributorNameDraft = {
  firstName: string;
  middleName: string;
  lastName: string;
};

export type AddDistributorBankDraft = {
  accountNumber: string;
  confirmAccountNumber: string;
  accountType: string;
  ifsc: string;
  accountVerified: boolean;
  verificationMode: "" | "auto" | "manual";
  manualMode: boolean;
  accountHolderName: string;
  bankName: string;
  branchName: string;
};

export const ADD_DISTRIBUTOR_BANK_ACCOUNT_TYPE_OPTIONS = [
  { value: "Savings", label: "Savings" },
  { value: "Current", label: "Current" },
  { value: "NRE", label: "NRE" },
  { value: "NRO", label: "NRO" },
] as const;

export function distributorBankAccountTypeLabel(accountType: string): string {
  return (
    ADD_DISTRIBUTOR_BANK_ACCOUNT_TYPE_OPTIONS.find((option) => option.value === accountType)
      ?.label ?? accountType
  );
}

export function isValidDistributorIfsc(value: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.trim().toUpperCase());
}

export function isAddDistributorBankDraftReady(bank: AddDistributorBankDraft): boolean {
  return (
    Boolean(bank.accountType) &&
    bank.accountNumber.replace(/\D/g, "").length >= 9 &&
    isValidDistributorIfsc(bank.ifsc)
  );
}

export function isAddDistributorBankManualDraftReady(bank: AddDistributorBankDraft): boolean {
  const account = bank.accountNumber.replace(/\D/g, "");
  const confirm = bank.confirmAccountNumber.replace(/\D/g, "");
  return (
    isAddDistributorBankDraftReady(bank) &&
    account === confirm &&
    bank.accountHolderName.trim().length >= 3 &&
    bank.bankName.trim().length >= 2 &&
    bank.branchName.trim().length >= 2
  );
}

export type AddDistributorAddressDraft = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

export type AddDistributorDocumentDraft = {
  panFileName: string | null;
  aadharFileName: string | null;
  panPreviewUrl: string | null;
  aadhaarPreviewUrl: string | null;
};

export function emptyNameDraft(): AddDistributorNameDraft {
  return { firstName: "", middleName: "", lastName: "" };
}

export function emptyBankDraft(): AddDistributorBankDraft {
  return {
    accountNumber: "",
    confirmAccountNumber: "",
    accountType: "",
    ifsc: "",
    accountVerified: false,
    verificationMode: "",
    manualMode: false,
    accountHolderName: "",
    bankName: "",
    branchName: "",
  };
}

export function emptyAddressDraft(): AddDistributorAddressDraft {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  };
}

export function emptyDocumentDraft(): AddDistributorDocumentDraft {
  return {
    panFileName: null,
    aadharFileName: null,
    panPreviewUrl: null,
    aadhaarPreviewUrl: null,
  };
}

export const ADD_DISTRIBUTOR_ACCEPTED_DOC_TYPES = ".pdf,.jpg,.jpeg,.png";
