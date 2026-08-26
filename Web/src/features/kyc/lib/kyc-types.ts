export type KycStatus = "none" | "pending" | "complete";

export type KycRecord = {
  status: KycStatus;
  panMasked?: string;
  submittedAt?: string;
  completedAt?: string;
};
