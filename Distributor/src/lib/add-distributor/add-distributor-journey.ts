import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  FileUp,
  Home,
  Landmark,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";

export type AddDistributorStepId =
  | "email"
  | "name"
  | "mobile"
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
    label: "Email verification",
    description: "Work email & OTP",
    icon: Mail,
  },
  {
    id: "name",
    label: "Distributor name",
    description: "First, middle, last",
    icon: UserRound,
  },
  {
    id: "mobile",
    label: "Mobile verification",
    description: "Number & SMS OTP",
    icon: Phone,
  },
  {
    id: "bank",
    label: "Bank account",
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
    label: "KYC documents",
    description: "PAN & Aadhaar upload",
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
