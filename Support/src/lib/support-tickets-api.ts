import { buildSupportTicketDetail } from "@/lib/support-ticket-detail-model";
import { SUPPORT_DUMMY_TICKETS } from "@/lib/support-tickets-dummy-data";
import type { SupportTicket, SupportTicketDetail } from "@/lib/support-types";

function normalizeClientRef(clientId: string): string {
  const trimmed = clientId.trim();
  return trimmed.endsWith("@zynd") ? trimmed.slice(0, -"@zynd".length) : trimmed;
}

export function listSupportTickets(clientId?: string): Promise<SupportTicket[]> {
  if (!clientId?.trim()) {
    return Promise.resolve([...SUPPORT_DUMMY_TICKETS]);
  }

  const ref = normalizeClientRef(clientId);
  const rows = SUPPORT_DUMMY_TICKETS.filter(
    (ticket) => ticket.userId === ref || ticket.userId === clientId.trim(),
  );
  return Promise.resolve(rows);
}

export function fetchSupportTicketDetail(ticketId: string): Promise<SupportTicketDetail> {
  const ref = ticketId.trim();
  const ticket = SUPPORT_DUMMY_TICKETS.find((row) => row.id === ref);
  if (!ticket) {
    return Promise.reject(Object.assign(new Error("Ticket not found"), { status: 404 }));
  }
  return Promise.resolve(buildSupportTicketDetail({ ...ticket }));
}

/** @deprecated Use fetchSupportTicketDetail */
export function fetchSupportTicket(ticketId: string): Promise<SupportTicket> {
  return fetchSupportTicketDetail(ticketId).then((detail) => detail.ticket);
}

export function isSupportTicketNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 404
  );
}
