import type {
  SupportAgent,
  SupportPlatformUpdate,
  SupportQuickReply,
} from "@/features/support/lib/support-types";

export const ZYND_HELP_BOT: SupportAgent = {
  name: "Zynd Help Bot",
  role: "Account assistant",
  initials: "ZH",
  status: "online",
  statusLabel: "Online",
};

export const ZYND_HELP_BOT_GREETING =
  "Hi, I'm Zynd Help Bot. Ask me about KYC, payments, your portfolio, goals, family groups, settings, or referrals.";

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
