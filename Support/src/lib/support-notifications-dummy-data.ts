export type SupportNotificationTone = "info" | "warning";

export type SupportNotification = {
  id: string;
  title: string;
  body: string;
  tone: SupportNotificationTone;
  createdAt: string;
  read: boolean;
};

export const SUPPORT_NOTIFICATIONS_SEED: SupportNotification[] = [
  {
    id: "ann-1",
    title: "System maintenance",
    body: "Scheduled on 18 Oct, 01:00–03:00 IST. Ticket replies may be delayed.",
    tone: "warning",
    createdAt: "2026-10-08T06:30:00.000Z",
    read: false,
  },
  {
    id: "ann-2",
    title: "KYC queue priority",
    body: "High-priority KYC tickets should be cleared within 4 business hours.",
    tone: "info",
    createdAt: "2026-10-06T09:15:00.000Z",
    read: false,
  },
  {
    id: "ann-3",
    title: "New SLA policy reference",
    body: "Redemption and payout tickets now use the 24h resolution target in the SLA tab.",
    tone: "info",
    createdAt: "2026-10-03T11:00:00.000Z",
    read: true,
  },
];
