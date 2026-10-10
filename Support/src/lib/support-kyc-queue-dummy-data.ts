export type SupportKycQueueStatus =
  | "Pending review"
  | "In progress"
  | "Escalated"
  | "Approved";

export type SupportKycReviewType =
  | "New KYC"
  | "Re-KYC"
  | "Document refresh"
  | "Address update";

export type SupportKycQueueItem = {
  id: string;
  clientCode: string;
  displayName: string;
  emailMasked: string;
  queueStatus: SupportKycQueueStatus;
  reviewType: SupportKycReviewType;
  submittedAt: string;
  priority: "Normal" | "High";
};

export const SUPPORT_DUMMY_KYC_QUEUE: SupportKycQueueItem[] = [
  {
    id: "kyc-q-001",
    clientCode: "ZYND-U-002",
    displayName: "Rahul Mehta",
    emailMasked: "rah***@outlook.com",
    queueStatus: "Pending review",
    reviewType: "Document refresh",
    submittedAt: "2026-10-05T09:00:00Z",
    priority: "High",
  },
  {
    id: "kyc-q-002",
    clientCode: "ZYND-U-003",
    displayName: "Priya Nair",
    emailMasked: "pri***@yahoo.com",
    queueStatus: "In progress",
    reviewType: "New KYC",
    submittedAt: "2026-10-08T12:30:00Z",
    priority: "High",
  },
  {
    id: "kyc-q-003",
    clientCode: "ZYND-U-001",
    displayName: "Ananya Sharma",
    emailMasked: "an***@gmail.com",
    queueStatus: "Escalated",
    reviewType: "Address update",
    submittedAt: "2026-10-04T08:30:00Z",
    priority: "Normal",
  },
  {
    id: "kyc-q-004",
    clientCode: "ZYND-U-005",
    displayName: "Sneha Patel",
    emailMasked: "sne***@gmail.com",
    queueStatus: "Approved",
    reviewType: "Re-KYC",
    submittedAt: "2026-09-20T10:00:00Z",
    priority: "Normal",
  },
  {
    id: "kyc-q-005",
    clientCode: "ZYND-U-004",
    displayName: "Vikram Singh",
    emailMasked: "vik***@icloud.com",
    queueStatus: "Approved",
    reviewType: "New KYC",
    submittedAt: "2026-08-15T14:00:00Z",
    priority: "Normal",
  },
];
