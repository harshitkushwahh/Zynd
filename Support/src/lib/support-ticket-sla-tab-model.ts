import { formatTicketTopicLabel } from "@/lib/support-ticket-display";
import type { SupportTicket, SupportTicketSlaTabData } from "@/lib/support-types";
import { formatDistributorDateTime } from "@/lib/format";

const NA = "NA";

function formatOptionalDateTime(iso: string | null | undefined): string {
  if (!iso) return NA;
  return formatDistributorDateTime(iso);
}

function defaultTargetHours(priority: SupportTicket["priority"]): {
  first: number;
  resolution: number;
} {
  if (priority === "high") return { first: 1, resolution: 8 };
  if (priority === "low") return { first: 4, resolution: 48 };
  return { first: 2, resolution: 24 };
}

function policyNameForTicket(ticket: SupportTicket): string {
  const fromRouting = ticket.routing?.slaRationale?.trim();
  if (fromRouting) return fromRouting.slice(0, 120);
  return `${formatTicketTopicLabel(ticket.topic)} ticket`;
}

function formatRemaining(hours: number | null | undefined): string {
  if (hours == null) return NA;
  if (hours <= 0) return "Overdue";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m remaining`;
  return `${Math.round(hours)}h remaining`;
}

function ringPctFromRemaining(remaining: number | null | undefined, targetHours: number): number {
  if (targetHours <= 0) return 0;
  if (remaining == null) return 0;
  if (remaining <= 0) return 100;
  return Math.max(8, Math.min(100, Math.round((remaining / targetHours) * 100)));
}

function formatRespondedElapsed(createdAt: string, respondedAt: string): string | undefined {
  const minutes = Math.round(
    (new Date(respondedAt).getTime() - new Date(createdAt).getTime()) / 60_000,
  );
  if (minutes < 1) return "Responded in under 1m";
  if (minutes < 60) return `Responded in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `Responded in ${hours}h ${rem}m` : `Responded in ${hours}h`;
}

function targetWindowLabel(targetHours: number, dueAt: string | null | undefined): string {
  if (!dueAt) return `${targetHours}h target`;
  return `${targetHours}h (within ${formatDistributorDateTime(dueAt)})`;
}

export function buildSupportTicketSlaTab(ticket: SupportTicket): SupportTicketSlaTabData {
  const sla = ticket.sla;
  const defaults = defaultTargetHours(ticket.priority);
  const responseTargetHours = sla?.firstResponseTargetHours ?? defaults.first;
  const resolutionTargetHours = sla?.resolutionTargetHours ?? defaults.resolution;

  const firstResponseDue = ticket.firstResponseDueAt ?? sla?.firstResponseDueAt ?? null;
  const resolutionDue = ticket.resolutionDueAt ?? sla?.resolutionDueAt ?? null;
  const firstResponseActual = ticket.firstRespondedAt ?? sla?.firstRespondedAt ?? null;
  const resolvedAt = ticket.resolvedAt ?? sla?.resolvedAt ?? null;

  const hasAgentReply = ticket.messages.some(
    (message) => message.role === "agent" && message.visibility !== "internal",
  );
  const isResolved = ticket.status === "resolved" || Boolean(sla?.resolutionMet);
  const firstResponseCompleted =
    Boolean(sla?.firstResponseMet) || Boolean(firstResponseActual) || hasAgentReply || isResolved;

  const priorityLabel =
    ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1) + " priority";

  const milestonesCompleted =
    (firstResponseCompleted ? 1 : 0) + (isResolved ? 1 : 0);
  const compliancePct = Math.round((milestonesCompleted / 2) * 100);

  const firstRemaining = sla?.firstResponseRemainingHours;
  const resolutionRemaining = sla?.resolutionRemainingHours;

  const firstOverdue = firstRemaining != null && firstRemaining <= 0 && !firstResponseCompleted;
  const resolutionOverdue = resolutionRemaining != null && resolutionRemaining <= 0 && !isResolved;

  let complianceStatusLabel = "In progress";
  let complianceTargetLabel = `${milestonesCompleted} of 2 milestones`;
  let complianceVariant: "success" | "warning" | "info" = "info";
  if (isResolved && firstResponseCompleted) {
    complianceStatusLabel = "Complete";
    complianceTargetLabel = "All milestones met";
    complianceVariant = "success";
  } else if (firstOverdue || resolutionOverdue) {
    complianceStatusLabel = "At risk";
    complianceTargetLabel = "SLA breach or overdue";
    complianceVariant = "warning";
  }

  return {
    policyName: policyNameForTicket(ticket),
    priorityLabel,
    overview: [
      {
        id: "first-response",
        title: "First response SLA",
        centerPrimary: firstResponseCompleted
          ? `${responseTargetHours}h`
          : formatRemaining(firstRemaining),
        centerSecondary: firstResponseCompleted ? "met" : firstRemaining != null ? "remaining" : undefined,
        progressPct: firstResponseCompleted
          ? 100
          : ringPctFromRemaining(firstRemaining, responseTargetHours),
        ringFill: "var(--chart-1)",
        targetLabel: targetWindowLabel(responseTargetHours, firstResponseDue),
        statusVariant: firstResponseCompleted ? "success" : firstOverdue ? "destructive" : "warning",
        statusLabel: firstResponseCompleted ? "Completed" : firstOverdue ? "Overdue" : "Pending",
        footnote: firstResponseCompleted
          ? firstResponseActual
            ? `Responded ${formatDistributorDateTime(firstResponseActual)}`
            : NA
          : firstRemaining != null
            ? formatRemaining(firstRemaining)
            : "Awaiting first reply",
      },
      {
        id: "resolution",
        title: "Resolution SLA",
        centerPrimary: isResolved ? "SLA met" : formatRemaining(resolutionRemaining),
        centerSecondary: isResolved ? undefined : resolutionRemaining != null ? "remaining" : undefined,
        progressPct: isResolved ? 100 : ringPctFromRemaining(resolutionRemaining, resolutionTargetHours),
        ringFill: "var(--chart-3)",
        targetLabel: targetWindowLabel(resolutionTargetHours, resolutionDue),
        statusVariant: isResolved ? "success" : resolutionOverdue ? "destructive" : "warning",
        statusLabel: isResolved ? "Completed" : resolutionOverdue ? "Overdue" : "In progress",
        footnote: isResolved
          ? resolvedAt
            ? `Resolved ${formatDistributorDateTime(resolvedAt)}`
            : NA
          : resolutionRemaining != null
            ? formatRemaining(resolutionRemaining)
            : NA,
      },
      {
        id: "compliance",
        title: "SLA compliance",
        centerPrimary: `${compliancePct}%`,
        progressPct: compliancePct,
        ringFill: "var(--chart-2)",
        targetLabel: complianceTargetLabel,
        statusVariant: complianceVariant,
        statusLabel: complianceStatusLabel,
        footnote: `${milestonesCompleted} of 2 completed`,
      },
    ],
    steps: [
      {
        id: "created",
        label: "Ticket created",
        dateLabel: formatOptionalDateTime(ticket.createdAt),
        status: "completed",
        badgeVariant: "success",
        badgeLabel: "Completed",
      },
      {
        id: "first-response",
        label: "First response",
        dateLabel: firstResponseCompleted
          ? formatOptionalDateTime(firstResponseActual)
          : formatOptionalDateTime(firstResponseDue),
        detailLabel:
          firstResponseCompleted && firstResponseActual
            ? formatRespondedElapsed(ticket.createdAt, firstResponseActual)
            : firstRemaining != null
              ? formatRemaining(firstRemaining)
              : undefined,
        status: firstResponseCompleted ? "completed" : "current",
        badgeVariant: firstResponseCompleted ? "success" : firstOverdue ? "destructive" : "warning",
        badgeLabel: firstResponseCompleted ? "Completed" : firstOverdue ? "Overdue" : "Due",
      },
      {
        id: "resolution",
        label: "Resolution due",
        dateLabel: formatOptionalDateTime(resolutionDue),
        detailLabel:
          isResolved || resolutionRemaining == null ? undefined : formatRemaining(resolutionRemaining),
        status: isResolved ? "completed" : "current",
        badgeVariant: isResolved ? "success" : resolutionOverdue ? "destructive" : "info",
        badgeLabel: isResolved ? "Completed" : resolutionOverdue ? "Overdue" : "Pending",
      },
      {
        id: "closure",
        label: "Ticket closure",
        dateLabel: isResolved ? formatOptionalDateTime(resolvedAt ?? ticket.updatedAt) : NA,
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
        expectedTime: formatOptionalDateTime(ticket.createdAt),
        actualTime: formatOptionalDateTime(ticket.createdAt),
        status: "completed",
        remarks: NA,
      },
      {
        id: "evt-first-response",
        index: 2,
        event: "First response",
        expectedTime: formatOptionalDateTime(firstResponseDue),
        actualTime: firstResponseCompleted
          ? formatOptionalDateTime(firstResponseActual)
          : NA,
        status: firstResponseCompleted ? "completed" : "pending",
        remarks: NA,
      },
      {
        id: "evt-resolution",
        index: 3,
        event: "Resolution",
        expectedTime: formatOptionalDateTime(resolutionDue),
        actualTime: isResolved ? formatOptionalDateTime(resolvedAt ?? ticket.updatedAt) : NA,
        status: isResolved ? "completed" : "pending",
        remarks: NA,
      },
      {
        id: "evt-closure",
        index: 4,
        event: "Ticket closure",
        expectedTime: formatOptionalDateTime(resolutionDue),
        actualTime: isResolved ? formatOptionalDateTime(resolvedAt ?? ticket.updatedAt) : NA,
        status: isResolved ? "completed" : "upcoming",
        remarks: NA,
      },
    ],
  };
}
