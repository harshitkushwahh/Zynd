export type SupportTicketStatus = "open" | "pending" | "resolved";
export type SupportTicketPriority = "low" | "medium" | "high";

export type SupportTicketMessage = {
  id: string;
  role: "user" | "agent" | "system";
  body: string;
  createdAt: string;
  senderName?: string;
};

export type SupportTicketAttachment = {
  id: string;
  fileName: string;
  uploadedAt?: string;
};

export type SupportTicket = {
  id: string;
  subject: string;
  /** Short summary shown under the ticket title on the detail page. */
  description: string;
  topic: "kyc" | "sip" | "payment" | "account" | "goals" | "other";
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  userId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  channel: "web_chat" | "email";
  messages: SupportTicketMessage[];
  attachments: SupportTicketAttachment[];
};

export type SupportTicketCustomerSnapshot = {
  displayName: string;
  emailMasked: string;
  mobileMasked: string;
  panMasked: string;
  aadhaarMasked: string;
  kycStatusLabel: string;
  kycCompliant: boolean;
  clientType: string;
  onboardingDate: string;
};

export type SupportTicketLinkedRecord = {
  key: string;
  title: string;
  recordId: string;
  href?: string;
  statusLabel?: string;
  description: string;
  /** Planned API route when support backend ships. */
  apiRoute: string;
  dataPoints: string[];
};

export type SupportTicketRelatedRecords = {
  records: SupportTicketLinkedRecord[];
  /** Other tickets for the same investor (excludes the ticket being viewed). */
  recentTickets: SupportTicket[];
};

export type SupportTicketActivityEntry = {
  id: string;
  summary: string;
  actor: string;
  createdAt: string;
};

export type SupportTicketDomainStatusVariant =
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "neutral";

export type SupportTicketDomainContext = {
  title: string;
  viewInHref?: string;
  viewInLabel?: string;
  statusLabel: string;
  statusVariant?: SupportTicketDomainStatusVariant;
  fields: Array<{ label: string; value: string }>;
};

export type SupportTicketSlaSummary = {
  remainingLabel: string;
  remainingPct: number;
  responseTarget: string;
  resolutionTarget: string;
};

export type SupportSlaRingGaugeModel = {
  id: string;
  title: string;
  centerPrimary: string;
  centerSecondary?: string;
  progressPct: number;
  ringFill: string;
  targetLabel: string;
  statusVariant: SupportTicketDomainStatusVariant;
  statusLabel: string;
  footnote?: string;
};

export type SupportSlaHorizontalStepStatus = "completed" | "current" | "upcoming";

export type SupportSlaHorizontalStep = {
  id: string;
  label: string;
  dateLabel: string;
  detailLabel?: string;
  status: SupportSlaHorizontalStepStatus;
  badgeVariant?: SupportTicketDomainStatusVariant;
  badgeLabel?: string;
};

export type SupportSlaEventRowStatus = "completed" | "pending" | "upcoming";

export type SupportSlaEventRow = {
  id: string;
  index: number;
  event: string;
  expectedTime: string;
  actualTime: string;
  status: SupportSlaEventRowStatus;
  remarks: string;
};

export type SupportTicketSlaTabData = {
  policyName: string;
  priorityLabel: string;
  overview: SupportSlaRingGaugeModel[];
  steps: SupportSlaHorizontalStep[];
  events: SupportSlaEventRow[];
};

export type SupportTicketSidebarMeta = {
  typeLabel: string;
  teamLabel: string;
  assignedTo: string;
  createdOn: string;
  lastUpdated: string;
};

export type SupportTicketDetail = {
  ticket: SupportTicket;
  customer: SupportTicketCustomerSnapshot;
  related: SupportTicketRelatedRecords;
  slaLabel: string;
  sla: SupportTicketSlaSummary;
  slaTab: SupportTicketSlaTabData;
  sidebarMeta: SupportTicketSidebarMeta;
  domain: SupportTicketDomainContext | null;
  activityLog: SupportTicketActivityEntry[];
};

export type SupportUserKycStatus = "verified" | "pending" | "rejected" | "not_started";

export type SupportEndUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  kycStatus: SupportUserKycStatus;
  joinedAt: string;
  lastActiveAt: string;
  openTicketCount: number;
};
