export type SupportKycRegistryField = {
  label: string;
  value: string | null;
};

export type SupportKycRegistryRecordVariant = {
  id: string;
  /** Shown in dropdown, e.g. last updated timestamp label */
  label: string;
  updatedAt: string;
  summaryFields: SupportKycRegistryField[];
  partnerResponse: Record<string, unknown>;
  systemStored: Record<string, unknown>;
};

export type SupportKycRegistryRecord = {
  id: "mf_investment_account" | "nominee" | "investor_profile";
  title: string;
  variants: SupportKycRegistryRecordVariant[];
};

export type SupportClientKycRegistrySnapshot = {
  records: SupportKycRegistryRecord[];
};
