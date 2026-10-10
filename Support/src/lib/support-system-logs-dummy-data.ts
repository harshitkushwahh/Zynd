export type SupportSystemLogLevel = "Info" | "Warning" | "Error";

export type SupportSystemLogEntry = {
  id: string;
  occurredAt: string;
  level: SupportSystemLogLevel;
  service: string;
  event: string;
  detail: string;
  correlationId: string;
};

export const SUPPORT_DUMMY_SYSTEM_LOGS: SupportSystemLogEntry[] = [
  {
    id: "sys-001",
    occurredAt: "2026-10-10T16:10:00Z",
    level: "Error",
    service: "Payout webhook",
    event: "settlement.delayed",
    detail: "Redemption payout confirmation not received from partner within SLA",
    correlationId: "wh_8f2a91c",
  },
  {
    id: "sys-002",
    occurredAt: "2026-10-10T15:55:00Z",
    level: "Warning",
    service: "MF OMS",
    event: "order.status.stale",
    detail: "Order ORD-202610-002 status unchanged for 36 hours",
    correlationId: "oms_44102",
  },
  {
    id: "sys-003",
    occurredAt: "2026-10-10T14:02:00Z",
    level: "Info",
    service: "KYC provider",
    event: "document.received",
    detail: "Address proof uploaded for ZYND-U-001",
    correlationId: "kyc_77ab0",
  },
  {
    id: "sys-004",
    occurredAt: "2026-10-10T12:30:00Z",
    level: "Info",
    service: "Auth",
    event: "support.session.created",
    detail: "Support console session started",
    correlationId: "auth_c0192",
  },
  {
    id: "sys-005",
    occurredAt: "2026-10-09T22:15:00Z",
    level: "Warning",
    service: "Scheduler",
    event: "job.retry",
    detail: "NAV sync job retried after transient timeout",
    correlationId: "job_nav_09",
  },
  {
    id: "sys-006",
    occurredAt: "2026-10-09T18:40:00Z",
    level: "Error",
    service: "Payment gateway",
    event: "mandate.debit.failed",
    detail: "SIP debit failed for client ZYND-U-003 — insufficient balance",
    correlationId: "pg_mnd_331",
  },
  {
    id: "sys-007",
    occurredAt: "2026-10-09T11:20:00Z",
    level: "Info",
    service: "Notifications",
    event: "email.sent",
    detail: "Ticket update email dispatched for TKT-1042",
    correlationId: "ntf_em_882",
  },
  {
    id: "sys-008",
    occurredAt: "2026-10-08T06:00:00Z",
    level: "Info",
    service: "Scheduler",
    event: "job.completed",
    detail: "Daily holdings reconciliation finished successfully",
    correlationId: "job_rec_08",
  },
  {
    id: "sys-009",
    occurredAt: "2026-10-07T19:45:00Z",
    level: "Warning",
    service: "Payout webhook",
    event: "signature.mismatch",
    detail: "Webhook signature validation failed — request ignored",
    correlationId: "wh_19c4e",
  },
];
