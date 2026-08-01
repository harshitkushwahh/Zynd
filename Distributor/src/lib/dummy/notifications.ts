export type DistributorNotificationKind =
  | "commission"
  | "compliance"
  | "lead"
  | "payroll";

export type DistributorNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  kind: DistributorNotificationKind;
};

/** Alerts for the logged-in distributor employee — not client order/txn feed. */
export const DISTRIBUTOR_DUMMY_NOTIFICATIONS: DistributorNotification[] = [
  {
    id: "n1",
    kind: "compliance",
    title: "Compliance follow-up due",
    body: "2 clients in your book need nominee updates before month-end.",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    read: false,
  },
  {
    id: "n2",
    kind: "commission",
    title: "Commission payout scheduled",
    body: "Jul 2026 commission of ₹18,420 will settle on 5 Aug.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    read: false,
  },
  {
    id: "n3",
    kind: "lead",
    title: "New lead in pipeline",
    body: "Branch walk-in referral — invite link sent to the prospect.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    read: true,
  },
  {
    id: "n4",
    kind: "payroll",
    title: "Payroll statement ready",
    body: "Jul 2026 take-home breakdown is available in My work.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    read: true,
  },
];

export function inferDistributorNotificationKind(
  title: string,
  body: string,
): DistributorNotificationKind {
  const haystack = `${title} ${body}`.toLowerCase();

  if (
    haystack.includes("commission") ||
    haystack.includes("incentive") ||
    haystack.includes("payout") ||
    haystack.includes("slab")
  ) {
    return "commission";
  }

  if (
    haystack.includes("compliance") ||
    haystack.includes("nominee") ||
    haystack.includes("kyc") ||
    haystack.includes("esign")
  ) {
    return "compliance";
  }

  if (
    haystack.includes("lead") ||
    haystack.includes("referral") ||
    haystack.includes("invite") ||
    haystack.includes("prospect") ||
    haystack.includes("confirmation") ||
    haystack.includes("investor") ||
    haystack.includes("purchase")
  ) {
    return "lead";
  }

  if (
    haystack.includes("payroll") ||
    haystack.includes("take-home") ||
    haystack.includes("leave") ||
    haystack.includes("attendance") ||
    haystack.includes("salary")
  ) {
    return "payroll";
  }

  return "lead";
}
