export type SupportAuditAction =
  | "ticket.viewed"
  | "ticket.status_changed"
  | "ticket.replied"
  | "ticket.assigned"
  | "user.viewed"
  | "login";

export type SupportAuditLog = {
  id: string;
  actorId: string;
  actorName: string;
  action: SupportAuditAction;
  targetType: "ticket" | "user" | "system";
  targetId: string;
  targetLabel: string;
  detail: string;
  createdAt: string;
};

export const DUMMY_AUDIT_LOGS: SupportAuditLog[] = [
  {
    id: "aud-901",
    actorId: "agent-aanya",
    actorName: "Aanya Sharma",
    action: "ticket.replied",
    targetType: "ticket",
    targetId: "tkt-2401",
    targetLabel: "KYC DigiLocker stuck on redirect",
    detail: "Asked user for DigiLocker error screenshot",
    createdAt: "2026-07-24T14:18:00.000Z",
  },
  {
    id: "aud-902",
    actorId: "agent-rahul",
    actorName: "Rahul Mehta",
    action: "ticket.status_changed",
    targetType: "ticket",
    targetId: "tkt-2402",
    targetLabel: "SIP debit failed for Axis Bluechip",
    detail: "Status set to pending — waiting on user confirmation",
    createdAt: "2026-07-24T12:21:00.000Z",
  },
  {
    id: "aud-903",
    actorId: "agent-aanya",
    actorName: "Aanya Sharma",
    action: "ticket.viewed",
    targetType: "ticket",
    targetId: "tkt-2406",
    targetLabel: "Wrong nominee shown on KYC summary",
    detail: "Opened ticket detail panel",
    createdAt: "2026-07-24T08:00:00.000Z",
  },
  {
    id: "aud-904",
    actorId: "agent-rahul",
    actorName: "Rahul Mehta",
    action: "user.viewed",
    targetType: "user",
    targetId: "usr-1005",
    targetLabel: "Sana Qureshi",
    detail: "Reviewed KYC and open tickets",
    createdAt: "2026-07-24T10:05:00.000Z",
  },
  {
    id: "aud-905",
    actorId: "agent-aanya",
    actorName: "Aanya Sharma",
    action: "ticket.assigned",
    targetType: "ticket",
    targetId: "tkt-2401",
    targetLabel: "KYC DigiLocker stuck on redirect",
    detail: "Assigned to self",
    createdAt: "2026-07-24T14:12:00.000Z",
  },
  {
    id: "aud-907",
    actorId: "agent-aanya",
    actorName: "Aanya Sharma",
    action: "ticket.status_changed",
    targetType: "ticket",
    targetId: "tkt-2404",
    targetLabel: "Payment failed on lumpsum order",
    detail: "Status set to resolved",
    createdAt: "2026-07-23T08:30:00.000Z",
  },
  {
    id: "aud-908",
    actorId: "agent-rahul",
    actorName: "Rahul Mehta",
    action: "login",
    targetType: "system",
    targetId: "support-console",
    targetLabel: "Support console",
    detail: "Signed in to support console (demo)",
    createdAt: "2026-07-24T07:00:00.000Z",
  },
  {
    id: "aud-909",
    actorId: "agent-aanya",
    actorName: "Aanya Sharma",
    action: "ticket.replied",
    targetType: "ticket",
    targetId: "tkt-2405",
    targetLabel: "Family goal contribution not reflecting",
    detail: "Explained allotment delay for goal funding",
    createdAt: "2026-07-24T10:10:00.000Z",
  },
  {
    id: "aud-910",
    actorId: "agent-aanya",
    actorName: "Aanya Sharma",
    action: "user.viewed",
    targetType: "user",
    targetId: "usr-1002",
    targetLabel: "Arjun Desai",
    detail: "Checked KYC pending state",
    createdAt: "2026-07-24T14:15:00.000Z",
  },
];
