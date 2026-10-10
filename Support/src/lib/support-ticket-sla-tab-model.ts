import { formatTicketTopicLabel } from "@/lib/support-ticket-display";
import type { SupportTicket, SupportTicketSlaTabData } from "@/lib/support-types";
import { formatDistributorDateTime } from "@/lib/format";

function addHoursIso(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function policyNameForTicket(ticket: SupportTicket): string {
  const topic = formatTicketTopicLabel(ticket.topic);
  return `Retail — ${topic} issue`;
}

export function buildSupportTicketSlaTab(ticket: SupportTicket): SupportTicketSlaTabData {
  const created = ticket.createdAt;
  const firstResponseDue = addHoursIso(created, 2);
  const resolutionDue = addHoursIso(created, 24);
  const firstResponseActual = addMinutesIso(created, 28);
  const hasAgentReply = ticket.messages.some((message) => message.role === "agent");
  const isResolved = ticket.status === "resolved";
  const priorityLabel =
    ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1) + " priority";

  const firstResponseCompleted =
    isResolved ||
    hasAgentReply ||
    (ticket.topic === "payment" && ticket.priority === "high" && ticket.status !== "resolved");

  return {
    policyName: policyNameForTicket(ticket),
    priorityLabel,
    overview: [
      {
        id: "first-response",
        title: "First response SLA",
        centerPrimary: firstResponseCompleted ? "2h" : "12h",
        centerSecondary: firstResponseCompleted ? "met" : "remaining",
        progressPct: firstResponseCompleted ? 100 : 76,
        ringFill: "var(--chart-1)",
        targetLabel: `2h (Within ${formatDistributorDateTime(firstResponseDue)})`,
        statusVariant: firstResponseCompleted ? "success" : "warning",
        statusLabel: firstResponseCompleted ? "Completed" : "Pending",
        footnote: firstResponseCompleted ? "Responded in 28m" : "Awaiting first reply",
      },
      {
        id: "resolution",
        title: "Resolution SLA",
        centerPrimary: isResolved ? "SLA" : "18h",
        centerSecondary: isResolved ? "met" : "remaining",
        progressPct: isResolved ? 100 : 62,
        ringFill: "var(--chart-3)",
        targetLabel: `24h (Within ${formatDistributorDateTime(resolutionDue)})`,
        statusVariant: isResolved ? "success" : "warning",
        statusLabel: isResolved ? "Completed" : "In progress",
        footnote: isResolved ? "Closed within policy" : "18h 12m left",
      },
      {
        id: "compliance",
        title: "SLA compliance",
        centerPrimary: isResolved ? "100%" : "87%",
        progressPct: isResolved ? 100 : 87,
        ringFill: "var(--chart-2)",
        targetLabel: isResolved ? "All milestones met" : "On track",
        statusVariant: "success",
        statusLabel: isResolved ? "Complete" : "On track",
        footnote: isResolved ? "2 of 2 completed" : "1 of 2 completed",
      },
    ],
    steps: [
      {
        id: "created",
        label: "Ticket created",
        dateLabel: formatDistributorDateTime(created),
        status: "completed",
        badgeVariant: "success",
        badgeLabel: "Completed",
      },
      {
        id: "first-response",
        label: "First response",
        dateLabel: firstResponseCompleted
          ? formatDistributorDateTime(firstResponseActual)
          : formatDistributorDateTime(firstResponseDue),
        detailLabel: firstResponseCompleted ? "Responded in 28m" : undefined,
        status: firstResponseCompleted ? "completed" : "current",
        badgeVariant: firstResponseCompleted ? "success" : "warning",
        badgeLabel: firstResponseCompleted ? "Completed" : "Due soon",
      },
      {
        id: "resolution",
        label: "Resolution due",
        dateLabel: formatDistributorDateTime(resolutionDue),
        detailLabel: isResolved ? undefined : "18h 12m remaining",
        status: isResolved ? "completed" : "current",
        badgeVariant: isResolved ? "success" : "info",
        badgeLabel: isResolved ? "Completed" : "Pending",
      },
      {
        id: "closure",
        label: "Ticket closure",
        dateLabel: isResolved ? formatDistributorDateTime(ticket.updatedAt) : "—",
        status: isResolved ? "completed" : "upcoming",
        badgeVariant: isResolved ? "success" : "neutral",
        badgeLabel: isResolved ? "Completed" : "Pending",
      },
    ],
    events: [
      {
        id: "evt-created",
        index: 1,
        event: "Ticket created",
        expectedTime: formatDistributorDateTime(created),
        actualTime: formatDistributorDateTime(created),
        status: "completed",
        remarks: "Auto-logged from investor chat",
      },
      {
        id: "evt-first-response",
        index: 2,
        event: "First response",
        expectedTime: formatDistributorDateTime(firstResponseDue),
        actualTime: firstResponseCompleted ? formatDistributorDateTime(firstResponseActual) : "—",
        status: firstResponseCompleted ? "completed" : "pending",
        remarks: firstResponseCompleted
          ? "Agent acknowledged payout delay"
          : "Waiting for agent reply",
      },
      {
        id: "evt-resolution",
        index: 3,
        event: "Resolution",
        expectedTime: formatDistributorDateTime(resolutionDue),
        actualTime: isResolved ? formatDistributorDateTime(ticket.updatedAt) : "—",
        status: isResolved ? "completed" : "pending",
        remarks: isResolved ? "Issue resolved with investor" : "Pending bank credit confirmation",
      },
      {
        id: "evt-closure",
        index: 4,
        event: "Ticket closure",
        expectedTime: formatDistributorDateTime(resolutionDue),
        actualTime: isResolved ? formatDistributorDateTime(ticket.updatedAt) : "—",
        status: isResolved ? "completed" : "upcoming",
        remarks: isResolved ? "Closure note sent" : "Will close after resolution",
      },
    ],
  };
}
