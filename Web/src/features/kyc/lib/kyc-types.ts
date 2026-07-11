export type KycStatus = "none" | "pending" | "complete";

export type KycRecord = {
  status: KycStatus;
  panNumber?: string;
  submittedAt?: string;
  completedAt?: string;
};
