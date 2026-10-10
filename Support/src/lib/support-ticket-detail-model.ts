import { SUPPORT_DUMMY_INVESTORS } from "@/lib/support-users-dummy-data";
import { SUPPORT_DUMMY_TICKETS } from "@/lib/support-tickets-dummy-data";
import { formatTicketTopicLabel } from "@/lib/support-ticket-display";
import type {
  SupportTicket,
  SupportTicketActivityEntry,
  SupportTicketDetail,
  SupportTicketCustomerSnapshot,
  SupportTicketDomainContext,
  SupportTicketSlaSummary,
  SupportTicketSidebarMeta,
} from "@/lib/support-types";
import { buildSupportTicketSlaTab } from "@/lib/support-ticket-sla-tab-model";
import { formatAum, formatDistributorDate, formatDistributorDateTime } from "@/lib/format";

function findInvestorForTicket(ticket: SupportTicket) {
  return SUPPORT_DUMMY_INVESTORS.find((row) => row.clientCode === ticket.userId);
}

function buildAadhaarMasked(clientCode: string): string {
  const suffix = clientCode.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `XXXX XXXX ${suffix}`;
}

function buildCustomerSnapshot(ticket: SupportTicket): SupportTicketCustomerSnapshot {
  const investor = findInvestorForTicket(ticket);
  const kycCompliant = investor?.complianceStatus === "Compliant";

  return {
    displayName: investor?.displayName ?? ticket.messages.find((m) => m.role === "user")?.senderName ?? ticket.userId,
    emailMasked: investor?.emailMasked ?? "—",
    mobileMasked: investor?.mobileMasked ?? "—",
    panMasked: investor?.panMasked ?? "—",
    aadhaarMasked: buildAadhaarMasked(ticket.userId),
    kycStatusLabel: kycCompliant ? "Verified" : "Not verified",
    kycCompliant,
    clientType: investor?.investorType ?? "Individual",
    onboardingDate: investor ? formatDistributorDate(investor.createdAt) : "—",
  };
}

function buildSlaLabel(ticket: SupportTicket): string {
  if (ticket.status === "resolved") return "SLA met";
  if (ticket.priority === "high") return "12h remaining";
  if (ticket.priority === "medium") return "24h remaining";
  return "48h remaining";
}

function buildSlaSummary(ticket: SupportTicket): SupportTicketSlaSummary {
  if (ticket.status === "resolved") {
    return {
      remainingLabel: "SLA met",
      remainingPct: 100,
      responseTarget: "Met within 2h",
      resolutionTarget: "Met within 24h",
    };
  }

  const remainingLabel = buildSlaLabel(ticket);
  const remainingPct =
    ticket.priority === "high" ? 72 : ticket.priority === "medium" ? 58 : 40;

  return {
    remainingLabel,
    remainingPct,
    responseTarget: "2h from first touch",
    resolutionTarget: "24h from creation",
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
    default:
      return "General Support";
  }
}

function buildSidebarMeta(ticket: SupportTicket): SupportTicketSidebarMeta {
  return {
    typeLabel: formatTicketTopicLabel(ticket.topic),
    teamLabel: teamLabelForTopic(ticket.topic),
    assignedTo: ticket.assigneeName ?? "Unassigned",
    createdOn: formatDistributorDateTime(ticket.createdAt),
    lastUpdated: formatDistributorDateTime(ticket.updatedAt),
  };
}

function buildDomainContext(ticket: SupportTicket): SupportTicketDomainContext | null {
  const userHref = `/dashboard/users/${encodeURIComponent(ticket.userId)}`;
  const userSuffix = ticket.userId.replace(/\D/g, "").slice(-3).padStart(3, "0");

  if (ticket.topic === "payment") {
    return {
      title: "Redemption details",
      viewInHref: `${userHref}?tab=portfolio`,
      viewInLabel: "View in Investment",
      statusLabel: "Pending bank credit",
      statusVariant: "warning",
      fields: [
        { label: "Amount", value: formatAum(125_000) },
        { label: "Folio number", value: `FOL-${userSuffix}-HDFC` },
        { label: "Order ID", value: `ORD-202610-001` },
        { label: "Fund name", value: "HDFC Flexi Cap Fund" },
        { label: "Redemption date", value: formatDistributorDate(ticket.createdAt) },
        { label: "Expected credit", value: formatDistributorDate(ticket.updatedAt) },
      ],
    };
  }

  if (ticket.topic === "kyc") {
    return {
      title: "KYC application",
      viewInHref: `${userHref}?tab=kyc`,
      viewInLabel: "View KYC journey",
      statusLabel: "Pending review",
      statusVariant: "warning",
      fields: [
        { label: "Application ID", value: `KYC-APP-${userSuffix}` },
        { label: "Document type", value: "Address proof" },
        { label: "Submitted on", value: formatDistributorDate(ticket.createdAt) },
        { label: "Last reviewed", value: formatDistributorDate(ticket.updatedAt) },
      ],
    };
  }

  if (ticket.topic === "sip") {
    return {
      title: "SIP mandate",
      viewInHref: `${userHref}?tab=activity`,
      viewInLabel: "View SIP activity",
      statusLabel: "Mandate pending",
      statusVariant: "warning",
      fields: [
        { label: "Scheme", value: "Parag Parikh Flexi Cap Fund" },
        { label: "Installment", value: formatAum(25_000) },
        { label: "Frequency", value: "Monthly" },
        { label: "Next debit", value: formatDistributorDate(ticket.updatedAt) },
      ],
    };
  }

  if (ticket.topic === "account") {
    return {
      title: "Account change",
      viewInHref: userHref,
      viewInLabel: "View profile",
      statusLabel: "Verification in progress",
      statusVariant: "info",
      fields: [
        { label: "Change type", value: "Bank account" },
        { label: "Reference", value: `CHG-${userSuffix}` },
        { label: "Requested on", value: formatDistributorDate(ticket.createdAt) },
      ],
    };
  }

  return null;
}

function buildActivityLog(ticket: SupportTicket): SupportTicketActivityEntry[] {
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
    if (message.role === "agent") {
      entries.push({
        id: `${ticket.id}-${message.id}-reply`,
        summary: "Reply added",
        actor: message.senderName ?? ticket.assigneeName ?? "Support Agent",
        createdAt: message.createdAt,
      });
    }
  }

  if (ticket.status === "resolved") {
    entries.push({
      id: `${ticket.id}-resolved`,
      summary: "Marked resolved",
      actor: ticket.assigneeName ?? "Support Agent",
      createdAt: ticket.updatedAt,
    });
  } else {
    entries.push({
      id: `${ticket.id}-updated`,
      summary: `Status set to ${ticket.status}`,
      actor: ticket.assigneeName ?? "Support Agent",
      createdAt: ticket.updatedAt,
    });
  }

  return entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function buildSupportTicketDetail(ticket: SupportTicket): SupportTicketDetail {
  const recentTickets = SUPPORT_DUMMY_TICKETS.filter(
    (row) => row.userId === ticket.userId && row.id !== ticket.id,
  ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const userSuffix = ticket.userId.replace(/\D/g, "").slice(-3).padStart(3, "0");

  const userHref = `/dashboard/users/${encodeURIComponent(ticket.userId)}`;
  const customer = buildCustomerSnapshot(ticket);

  return {
    ticket,
    customer,
    related: {
      recentTickets,
      records: [
        {
          key: "user",
          title: "Investor profile",
          recordId: ticket.userId,
          href: userHref,
          statusLabel: customer.kycStatusLabel,
          description: customer.displayName,
          apiRoute: "GET /api/v1/support/users/{client_code}",
          dataPoints: [
            "client_code",
            "display_name",
            "email_masked",
            "mobile_masked",
            "compliance_status",
            "onboarding_status",
          ],
        },
        {
          key: "investment",
          title: "Investment account",
          recordId: `INV-${userSuffix}`,
          statusLabel: customer.kycCompliant ? "Active" : "Restricted",
          description: "MF holdings and folio summary for support lookup.",
          apiRoute: "GET /api/v1/support/users/{client_code}/portfolio",
          dataPoints: ["folio_ids", "total_aum", "holdings_count", "last_synced_at"],
        },
        {
          key: "kyc",
          title: "KYC application",
          recordId: `KYC-APP-${userSuffix}`,
          statusLabel: customer.kycStatusLabel,
          description: "Latest KYC journey tied to this investor.",
          apiRoute: "GET /api/v1/support/users/{client_code}/kyc",
          dataPoints: ["kyc_journey_id", "overall_status", "step_statuses", "last_updated_at"],
        },
        {
          key: "ticket",
          title: "This ticket",
          recordId: ticket.id,
          statusLabel: ticket.status,
          description: ticket.subject,
          apiRoute: "GET /api/v1/support/tickets/{ticket_id}",
          dataPoints: [
            "ticket_id",
            "user_id",
            "status",
            "priority",
            "assignee_id",
            "messages",
          ],
        },
      ],
    },
    slaLabel: buildSlaLabel(ticket),
    sla: buildSlaSummary(ticket),
    slaTab: buildSupportTicketSlaTab(ticket),
    sidebarMeta: buildSidebarMeta(ticket),
    domain: buildDomainContext(ticket),
    activityLog: buildActivityLog(ticket),
  };
}
