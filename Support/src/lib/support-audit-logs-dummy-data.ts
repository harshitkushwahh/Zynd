export type SupportAuditLogEntry = {
  id: string;
  occurredAt: string;
  action: string;
  resource: string;
  detail: string;
  actor: string;
  actorRole: "Support Agent" | "Support Lead" | "System";
};

export const SUPPORT_DUMMY_AUDIT_LOGS: SupportAuditLogEntry[] = [
  {
    id: "aud-001",
    occurredAt: "2026-10-10T16:02:00Z",
    action: "Ticket viewed",
    resource: "TKT-1104",
    detail: "Opened ticket detail for redemption payout case",
    actor: "Support Lead",
    actorRole: "Support Lead",
  },
  {
    id: "aud-002",
    occurredAt: "2026-10-10T15:48:00Z",
    action: "User profile opened",
    resource: "ZYND-U-002",
    detail: "Viewed investor profile from ticket linked records",
    actor: "Support Lead",
    actorRole: "Support Lead",
  },
  {
    id: "aud-003",
    occurredAt: "2026-10-10T14:20:00Z",
    action: "Ticket assigned",
    resource: "TKT-1042",
    detail: "Assigned to Support Agent",
    actor: "System",
    actorRole: "System",
  },
  {
    id: "aud-004",
    occurredAt: "2026-10-10T11:05:00Z",
    action: "Internal note added",
    resource: "TKT-1104",
    detail: "Added note on payout reconciliation",
    actor: "Support Agent",
    actorRole: "Support Agent",
  },
  {
    id: "aud-005",
    occurredAt: "2026-10-09T18:30:00Z",
    action: "KYC queue opened",
    resource: "ZYND-U-003",
    detail: "Opened KYC tab from verification queue",
    actor: "Support Agent",
    actorRole: "Support Agent",
  },
  {
    id: "aud-006",
    occurredAt: "2026-10-09T09:12:00Z",
    action: "Transaction viewed",
    resource: "ORD-202610-002",
    detail: "Opened failed redemption order detail",
    actor: "Support Lead",
    actorRole: "Support Lead",
  },
  {
    id: "aud-007",
    occurredAt: "2026-10-08T17:00:00Z",
    action: "Console login",
    resource: "Support console",
    detail: "Successful OTP login",
    actor: "Support Agent",
    actorRole: "Support Agent",
  },
  {
    id: "aud-008",
    occurredAt: "2026-10-08T08:45:00Z",
    action: "Ticket status changed",
    resource: "TKT-892",
    detail: "Marked resolved after nominee flow fix",
    actor: "Support Agent",
    actorRole: "Support Agent",
  },
];
