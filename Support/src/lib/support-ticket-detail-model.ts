import { formatTicketTopicLabel } from "@/lib/support-ticket-display";
import type {
  SupportTicket,
  SupportTicketActivityEntry,
  SupportTicketDetail,
  SupportTicketCustomerSnapshot,
  SupportTicketDomainContext,
  SupportTicketLinkedRecord,
  SupportTicketSlaSummary,
  SupportTicketSidebarMeta,
} from "@/lib/support-types";
import { buildSupportTicketSlaTab } from "@/lib/support-ticket-sla-tab-model";
import { normalizeSupportDisplayValue } from "@/lib/support-display-value";
import { formatDistributorDateTime } from "@/lib/format";

function buildCustomerSnapshotFallback(ticket: SupportTicket): SupportTicketCustomerSnapshot {
  return {
    displayName:
      ticket.messages.find((message) => message.role === "user")?.senderName ?? ticket.userId,
    emailMasked: normalizeSupportDisplayValue(null),
    mobileMasked: normalizeSupportDisplayValue(null),
    panMasked: normalizeSupportDisplayValue(null),
    aadhaarMasked: normalizeSupportDisplayValue(null),
    kycStatusLabel: "Unknown",
    kycCompliant: false,
    clientType: "Individual",
    onboardingDate: normalizeSupportDisplayValue(null),
  };
}

function formatHoursRemaining(hours: number | null | undefined): string {
  if (hours == null) return "NA";
  if (hours <= 0) return "Overdue";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m remaining`;
  return `${Math.round(hours)}h remaining`;
}

function buildSlaLabel(ticket: SupportTicket): string {
  const sla = ticket.sla;
  if (ticket.status === "resolved" || sla?.resolutionMet) return "SLA met";
  const resolutionHours = sla?.resolutionRemainingHours;
  if (resolutionHours != null) return formatHoursRemaining(resolutionHours);
  return "NA";
}

function buildSlaSummary(ticket: SupportTicket): SupportTicketSlaSummary {
  const sla = ticket.sla;
  const responseHours = sla?.firstResponseTargetHours ?? (ticket.priority === "high" ? 1 : ticket.priority === "medium" ? 2 : 4);
  const resolutionHours = sla?.resolutionTargetHours ?? (ticket.priority === "high" ? 8 : ticket.priority === "medium" ? 24 : 48);

  if (ticket.status === "resolved" || sla?.resolutionMet) {
    return {
      remainingLabel: "SLA met",
      remainingPct: 100,
      responseTarget: `Met within ${responseHours}h`,
      resolutionTarget: `Met within ${resolutionHours}h`,
    };
  }

  const remainingLabel = buildSlaLabel(ticket);
  const resolutionRemaining = sla?.resolutionRemainingHours;
  const remainingPct =
    resolutionRemaining == null
      ? 0
      : Math.max(
          8,
          Math.min(100, Math.round((resolutionRemaining / resolutionHours) * 100)),
        );

  return {
    remainingLabel,
    remainingPct,
    responseTarget: `${responseHours}h from creation`,
    resolutionTarget: `${resolutionHours}h from creation`,
  };
}

function teamLabelForTopic(topic: SupportTicket["topic"]): string {
  switch (topic) {
    case "kyc":
      return "KYC Support";
    case "payment":
      return "Payments Support";
    case "sip":
      return "Investments Support";
    case "account":
      return "Account Support";
    case "family":
      return "Family Support";
    case "portfolio":
      return "Portfolio Support";
    case "referrals":
      return "Referral Support";
    case "goals":
      return "Goals Support";
    default:
      return "General Support";
  }
}

function buildSidebarMeta(ticket: SupportTicket): SupportTicketSidebarMeta {
  return {
    typeLabel: formatTicketTopicLabel(ticket.topic),
    teamLabel: teamLabelForTopic(ticket.topic),
    assignedTo: ticket.assigneeId
      ? normalizeSupportDisplayValue(ticket.assigneeName)
      : normalizeSupportDisplayValue(null),
    createdOn: formatDistributorDateTime(ticket.createdAt),
    lastUpdated: formatDistributorDateTime(ticket.updatedAt),
  };
}

function buildActivityLog(ticket: SupportTicket): SupportTicketActivityEntry[] {
  const agentActor = ticket.assigneeName?.trim() || "NA";
  const entries: SupportTicketActivityEntry[] = [
    {
      id: `${ticket.id}-created`,
      summary: "Ticket created",
      actor: "System",
      createdAt: ticket.createdAt,
    },
  ];

  if (ticket.assigneeName) {
    entries.push({
      id: `${ticket.id}-assigned`,
      summary: `Assigned to ${ticket.assigneeName}`,
      actor: "Support routing",
      createdAt: ticket.createdAt,
    });
  }

  for (const message of ticket.messages) {
    if (message.role === "bot") {
      entries.push({
        id: `${ticket.id}-${message.id}-bot`,
        summary: "Zynd Help Bot replied",
        actor: message.senderName ?? "Zynd Help Bot",
        createdAt: message.createdAt,
      });
    }
    if (message.role === "agent" && message.visibility !== "internal") {
      entries.push({
        id: `${ticket.id}-${message.id}-reply`,
        summary: "Reply added",
        actor: message.senderName ?? agentActor,
        createdAt: message.createdAt,
      });
    }
  }

  if (ticket.status === "resolved") {
    entries.push({
      id: `${ticket.id}-resolved`,
      summary: "Marked resolved",
      actor: agentActor,
      createdAt: ticket.updatedAt,
    });
  } else {
    entries.push({
      id: `${ticket.id}-updated`,
      summary: `Status set to ${ticket.status}`,
      actor: agentActor,
      createdAt: ticket.updatedAt,
    });
  }

  return entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function buildSupportTicketDetail(
  ticket: SupportTicket,
  live?: {
    customer: SupportTicketCustomerSnapshot;
    recentTickets: SupportTicket[];
    domain: SupportTicketDomainContext | null;
    linkedRecords?: SupportTicketLinkedRecord[];
  },
): SupportTicketDetail {
  const recentTickets = live?.recentTickets ?? [];
  const customer = live?.customer ?? buildCustomerSnapshotFallback(ticket);
  const domain = live?.domain ?? null;
  const linkedRecords = live?.linkedRecords ?? [];

  return {
    ticket,
    customer,
    related: {
      recentTickets,
      records: linkedRecords,
    },
    slaLabel: buildSlaLabel(ticket),
    sla: buildSlaSummary(ticket),
    slaTab: buildSupportTicketSlaTab(ticket),
    sidebarMeta: buildSidebarMeta(ticket),
    domain,
    activityLog: buildActivityLog(ticket),
  };
}
