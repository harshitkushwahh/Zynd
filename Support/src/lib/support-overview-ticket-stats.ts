import type { SupportTicket } from "@/lib/support-types";
import { SUPPORT_OVERVIEW_AGENT_ASSIGNEE } from "@/lib/support-overview-analytics-data";

export function filterTicketsForAgentQueue(tickets: SupportTicket[]): SupportTicket[] {
  return tickets.filter(
    (ticket) =>
      ticket.assigneeId === SUPPORT_OVERVIEW_AGENT_ASSIGNEE || ticket.assigneeId === null,
  );
}

export function summarizeAgentTicketQueue(tickets: SupportTicket[]) {
  const open = tickets.filter((ticket) => ticket.status === "open").length;
  const inProgress = tickets.filter((ticket) => ticket.status === "pending").length;
  const resolved = tickets.filter((ticket) => ticket.status === "resolved").length;

  return {
    total: tickets.length,
    open,
    inProgress,
    resolved,
  };
}

export function sortTicketsByRecentActivity(tickets: SupportTicket[]): SupportTicket[] {
  return [...tickets].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}
