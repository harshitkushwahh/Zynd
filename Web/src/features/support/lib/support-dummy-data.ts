import type {
  SupportAgent,
  SupportMessage,
  SupportPlatformUpdate,
  SupportQuickReply,
  SupportRecentTicket,
} from "@/features/support/lib/support-types";

export const SUPPORT_AGENT: SupportAgent = {
  name: "Aanya Sharma",
  role: "Support Specialist",
  initials: "AS",
  status: "online",
  statusLabel: "Online · usually replies in a few minutes",
};

export const SUPPORT_QUICK_REPLIES: SupportQuickReply[] = [
  {
    id: "qr-kyc",
    label: "KYC help",
    message: "I need help with my KYC verification.",
  },
  {
    id: "qr-sip",
    label: "SIP issue",
    message: "I have a question about my SIP.",
  },
  {
    id: "qr-payment",
    label: "Payment failed",
    message: "My payment failed. Can you help me check what went wrong?",
  },
  {
    id: "qr-account",
    label: "Account access",
    message: "I'm having trouble accessing my account.",
  },
];

const now = Date.now();

export const SUPPORT_INITIAL_MESSAGES: SupportMessage[] = [
  {
    id: "msg-1",
    role: "system",
    body: "You are connected to Zynd Support. This is a demo chat — replies are simulated.",
    createdAt: new Date(now - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "msg-2",
    role: "agent",
    senderName: SUPPORT_AGENT.name,
    body: "Hi there! I'm Aanya from Zynd Support. How can I help you today?",
    createdAt: new Date(now - 1000 * 60 * 17).toISOString(),
  },
  {
    id: "msg-3",
    role: "user",
    body: "Hi — I wanted to check the status of my recent mutual fund order.",
    createdAt: new Date(now - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "msg-4",
    role: "agent",
    senderName: SUPPORT_AGENT.name,
    body: "Of course. I can see a sample order for Axis Bluechip Fund marked as Processing. In the live product this would pull from your account — here it's demo data.",
    createdAt: new Date(now - 1000 * 60 * 14).toISOString(),
  },
  {
    id: "msg-5",
    role: "agent",
    senderName: SUPPORT_AGENT.name,
    body: "Feel free to ask about KYC, SIPs, payments, or goals. I'll reply with a simulated answer.",
    createdAt: new Date(now - 1000 * 60 * 13).toISOString(),
  },
];

const AGENT_REPLY_POOL = [
  "Thanks for sharing that. I've noted your request in this demo chat — a real agent would look into your account next.",
  "Got it. In production we'd open a ticket and update you here. For now, this is a front-end preview with dummy replies.",
  "I understand. A common next step is checking Transactions or My SIPs in your dashboard while we look into this.",
  "Thanks — I've tagged this as a general support query. Anything else I can help with while we're in demo mode?",
  "Noted. If this were live, we'd verify your identity and share an exact status update within a few minutes.",
];

export function getDummyAgentReply(userMessage: string): string {
  const normalized = userMessage.toLowerCase();

  if (normalized.includes("kyc")) {
    return "For KYC, open Profile → Complete KYC and follow DigiLocker / eSign steps. In this demo I can't update your real status, but that's where you'd continue.";
  }
  if (normalized.includes("sip")) {
    return "You can review active SIPs under My SIPs. Pause, skip, or edit options would appear there in the live app. Anything specific about an SIP amount or date?";
  }
  if (normalized.includes("payment") || normalized.includes("failed")) {
    return "Failed payments usually show under Transactions with a reason code. Retry from Invest once your bank allows it — this reply is simulated.";
  }
  if (normalized.includes("account") || normalized.includes("login") || normalized.includes("access")) {
    return "Try signing out and back in, or use Forgot password from the sign-in screen. If MFA is on, use your authenticator or a backup code.";
  }
  if (normalized.includes("goal")) {
    return "Goals live under Dashboard → Goals. You can create personal or family goals and track funding from Invest. Happy to walk through a specific step.";
  }

  const index = Math.abs(hashString(userMessage)) % AGENT_REPLY_POOL.length;
  return AGENT_REPLY_POOL[index]!;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export const SUPPORT_ALL_TICKETS: SupportRecentTicket[] = [
  {
    id: "tkt-2401",
    status: "open",
    statusLabel: "Open",
    title: "KYC DigiLocker stuck on redirect",
    description:
      "DigiLocker keeps bouncing back after OTP. Waiting on a screenshot from you.",
    updatedAt: new Date(now - 1000 * 60 * 95).toISOString(),
  },
  {
    id: "tkt-2402",
    status: "pending",
    statusLabel: "Pending",
    title: "SIP debit failed for Axis Bluechip",
    description:
      "Bank returned insufficient funds. Confirm when we should retry the mandate.",
    updatedAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: "tkt-2403",
    status: "open",
    statusLabel: "Open",
    title: "Family goal contribution not reflecting",
    description:
      "Linked a lumpsum to a family goal but progress is still at 0%. Checking allocation mapping.",
    updatedAt: new Date(now - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: "tkt-2404",
    status: "resolved",
    statusLabel: "Resolved",
    title: "Payment failed on lumpsum order",
    description:
      "UPI timeout voided the order cleanly. You can retry from Invest anytime.",
    updatedAt: new Date(now - 1000 * 60 * 60 * 28).toISOString(),
  },
  {
    id: "tkt-2405",
    status: "resolved",
    statusLabel: "Resolved",
    title: "Risk profile assessment resume issue",
    description:
      "Assessment session expired mid-way. You can restart from Risk Profile anytime.",
    updatedAt: new Date(now - 1000 * 60 * 60 * 52).toISOString(),
  },
  {
    id: "tkt-2406",
    status: "pending",
    statusLabel: "Pending",
    title: "Mandate registration delayed",
    description:
      "Bank is still processing the e-mandate. We'll update once confirmation arrives.",
    updatedAt: new Date(now - 1000 * 60 * 60 * 74).toISOString(),
  },
];

/** Compact popover list — newest tickets only. */
export const SUPPORT_RECENT_TICKETS = SUPPORT_ALL_TICKETS.slice(0, 3);

export const SUPPORT_PLATFORM_UPDATES: SupportPlatformUpdate[] = [
  {
    id: "upd-1",
    badge: "Improvement",
    tone: "improvement",
    title: "Smarter defaults on the SIP review page",
    description:
      "Review screens now highlight mandate status and next debit date before you confirm.",
    publishedAt: "2026-06-24T10:00:00.000Z",
  },
  {
    id: "upd-2",
    badge: "New",
    tone: "new",
    title: "Family goals funding is live",
    description:
      "Link investments to family goals and track shared progress from the Goals hub.",
    publishedAt: "2026-06-18T10:00:00.000Z",
  },
  {
    id: "upd-3",
    badge: "Update",
    tone: "update",
    title: "Faster KYC resume after DigiLocker",
    description:
      "Returning from DigiLocker now restores your KYC step without restarting the flow.",
    publishedAt: "2026-06-10T10:00:00.000Z",
  },
];
