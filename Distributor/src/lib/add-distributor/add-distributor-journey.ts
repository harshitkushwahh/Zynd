import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
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
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifsc: string;
  bankName: string;
  branchName: string;
};

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
};

export function emptyNameDraft(): AddDistributorNameDraft {
  return { firstName: "", middleName: "", lastName: "" };
}

export function emptyBankDraft(): AddDistributorBankDraft {
  return {
    accountHolderName: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifsc: "",
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
  return { panFileName: null, aadharFileName: null };
}

/** Same demo OTP as investor onboarding. */
export const ADD_DISTRIBUTOR_DEMO_OTP = "123456";

export const ADD_DISTRIBUTOR_ACCEPTED_DOC_TYPES = ".pdf,.jpg,.jpeg,.png";
