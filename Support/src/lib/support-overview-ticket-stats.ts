import type { SupportTicket } from "@/lib/support-types";

export function filterTicketsForAgentQueue(
  tickets: SupportTicket[],
  agentId?: string | null,
): SupportTicket[] {
  return tickets.filter((ticket) => {
    if (ticket.handledBy === "bot") return false;
    return ticket.assigneeId === null || (agentId != null && ticket.assigneeId === agentId);
  });
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
