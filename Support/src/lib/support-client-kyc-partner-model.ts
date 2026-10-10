export type SupportKycPartnerVerificationStatus =
  | "verified"
  | "pending"
  | "failed"
  | "not_started"
  | "skipped";

export type SupportKycPartnerResponseTabId =
  | "verification"
  | "digilocker"
  | "bank"
  | "ifsc"
  | "esign";

export type SupportKycVerificationStatusCard = {
  id: "pan" | "digilocker" | "bank" | "esign";
  label: string;
  status: SupportKycPartnerVerificationStatus;
  statusLabel: string;
  hint: string;
  partnerRef: string | null;
  updatedAt: string | null;
};

export type SupportKycPartnerResponseMeta = {
  partner: string;
  externalId: string | null;
  httpStatus: number | null;
  recordedAt: string;
  status: SupportKycPartnerVerificationStatus;
  statusLabel: string;
};

export type SupportKycIfscLookupSummary = {
  ifscCode: string;
  bankName: string;
  branchLabel: string;
  city: string | null;
  state: string | null;
};

export type SupportKycPartnerResponseVariant = SupportKycPartnerResponseMeta & {
  id: string;
  label: string;
  payload: Record<string, unknown>;
  summary?: SupportKycIfscLookupSummary | null;
};

export type SupportKycPartnerResponseTab = {
  variants: SupportKycPartnerResponseVariant[];
};

export type SupportKycPartnerResponseBundle = {
  verification: SupportKycPartnerResponseTab;
  digilocker: SupportKycPartnerResponseTab;
  bank: SupportKycPartnerResponseTab;
  ifsc: SupportKycPartnerResponseTab;
  esign: SupportKycPartnerResponseTab;
};

export type SupportClientKycPartnerSnapshot = {
  verificationCards: SupportKycVerificationStatusCard[];
  responses: SupportKycPartnerResponseBundle;
};
