export type SupportTicketStatus = "open" | "pending" | "resolved";
export type SupportTicketPriority = "low" | "medium" | "high";

export type SupportTicketMessage = {
  id: string;
  role: "user" | "agent" | "system";
  body: string;
  createdAt: string;
  senderName?: string;
};

export type SupportTicket = {
  id: string;
  subject: string;
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
  attachmentCount: number;
};

export const DUMMY_TICKETS: SupportTicket[] = [
  {
    id: "tkt-2401",
    subject: "KYC DigiLocker stuck on redirect",
    topic: "kyc",
    status: "open",
    priority: "high",
    userId: "usr-1002",
    assigneeId: "agent-aanya",
    assigneeName: "Aanya Sharma",
    createdAt: "2026-07-24T14:10:00.000Z",
    updatedAt: "2026-07-24T18:05:00.000Z",
    channel: "web_chat",
    attachmentCount: 1,
    messages: [
      {
        id: "tm-1",
        role: "system",
        body: "Ticket created from Web Contact Support chat.",
        createdAt: "2026-07-24T14:10:00.000Z",
      },
      {
        id: "tm-2",
        role: "user",
        body: "I need help with my KYC verification. DigiLocker keeps bouncing me back.",
        createdAt: "2026-07-24T14:11:00.000Z",
        senderName: "Arjun Desai",
      },
      {
        id: "tm-3",
        role: "agent",
        body: "Hi Arjun — I can see a pending DigiLocker return. Could you share a screenshot of the error screen?",
        createdAt: "2026-07-24T14:18:00.000Z",
        senderName: "Aanya Sharma",
      },
      {
        id: "tm-4",
        role: "user",
        body: "Uploaded the screenshot. Still stuck after OTP.",
        createdAt: "2026-07-24T18:02:00.000Z",
        senderName: "Arjun Desai",
      },
    ],
  },
  {
    id: "tkt-2402",
    subject: "SIP debit failed for Axis Bluechip",
    topic: "sip",
    status: "pending",
    priority: "medium",
    userId: "usr-1001",
    assigneeId: "agent-rahul",
    assigneeName: "Rahul Mehta",
    createdAt: "2026-07-24T09:40:00.000Z",
    updatedAt: "2026-07-24T12:20:00.000Z",
    channel: "web_chat",
    attachmentCount: 0,
    messages: [
      {
        id: "tm-5",
        role: "user",
        body: "My SIP payment failed yesterday. Can you check what went wrong?",
        createdAt: "2026-07-24T09:40:00.000Z",
        senderName: "Priya Nair",
      },
      {
        id: "tm-6",
        role: "agent",
        body: "Looking at the mandate — bank returned insufficient funds. Waiting for your confirmation to retry.",
        createdAt: "2026-07-24T12:20:00.000Z",
        senderName: "Rahul Mehta",
      },
    ],
  },
  {
    id: "tkt-2403",
    subject: "Cannot access account after MFA reset",
    topic: "account",
    status: "open",
    priority: "high",
    userId: "usr-1004",
    assigneeId: null,
    assigneeName: null,
    createdAt: "2026-07-24T19:15:00.000Z",
    updatedAt: "2026-07-24T19:15:00.000Z",
    channel: "email",
    attachmentCount: 0,
    messages: [
      {
        id: "tm-7",
        role: "user",
        body: "I'm having trouble accessing my account after rotating authenticator apps.",
        createdAt: "2026-07-24T19:15:00.000Z",
        senderName: "Kabir Singh",
      },
    ],
  },
  {
    id: "tkt-2404",
    subject: "Payment failed on lumpsum order",
    topic: "payment",
    status: "resolved",
    priority: "medium",
    userId: "usr-1003",
    assigneeId: "agent-aanya",
    assigneeName: "Aanya Sharma",
    createdAt: "2026-07-22T11:00:00.000Z",
    updatedAt: "2026-07-23T08:30:00.000Z",
    channel: "web_chat",
    attachmentCount: 0,
    messages: [
      {
        id: "tm-8",
        role: "user",
        body: "Payment failed while investing ₹25,000.",
        createdAt: "2026-07-22T11:00:00.000Z",
        senderName: "Meera Iyer",
      },
      {
        id: "tm-9",
        role: "agent",
        body: "Bank UPI timeout — order voided cleanly. Please retry from Invest.",
        createdAt: "2026-07-22T11:25:00.000Z",
        senderName: "Aanya Sharma",
      },
      {
        id: "tm-10",
        role: "system",
        body: "Ticket marked resolved.",
        createdAt: "2026-07-23T08:30:00.000Z",
      },
    ],
  },
  {
    id: "tkt-2405",
    subject: "Family goal contribution not reflecting",
    topic: "goals",
    status: "open",
    priority: "low",
    userId: "usr-1005",
    assigneeId: "agent-rahul",
    assigneeName: "Rahul Mehta",
    createdAt: "2026-07-24T07:50:00.000Z",
    updatedAt: "2026-07-24T10:10:00.000Z",
    channel: "web_chat",
    attachmentCount: 0,
    messages: [
      {
        id: "tm-11",
        role: "user",
        body: "I invested toward our family education goal but progress is still 0%.",
        createdAt: "2026-07-24T07:50:00.000Z",
        senderName: "Sana Qureshi",
      },
      {
        id: "tm-12",
        role: "agent",
        body: "Order is still processing — goal funding updates after units allot. I'll ping you when it posts.",
        createdAt: "2026-07-24T10:10:00.000Z",
        senderName: "Rahul Mehta",
      },
    ],
  },
  {
    id: "tkt-2406",
    subject: "Wrong nominee shown on KYC summary",
    topic: "kyc",
    status: "pending",
    priority: "medium",
    userId: "usr-1002",
    assigneeId: "agent-aanya",
    assigneeName: "Aanya Sharma",
    createdAt: "2026-07-23T16:40:00.000Z",
    updatedAt: "2026-07-24T08:00:00.000Z",
    channel: "email",
    attachmentCount: 2,
    messages: [
      {
        id: "tm-13",
        role: "user",
        body: "Nominee name is incorrect on the KYC review screen.",
        createdAt: "2026-07-23T16:40:00.000Z",
        senderName: "Arjun Desai",
      },
    ],
  },
];

export function getDummyTicket(id: string): SupportTicket | undefined {
  return DUMMY_TICKETS.find((ticket) => ticket.id === id);
}

export function getTicketsForUser(userId: string): SupportTicket[] {
  return DUMMY_TICKETS.filter((ticket) => ticket.userId === userId);
}
