import type { SupportRealtimeEvent } from "@/features/support/lib/support-realtime";
import type { SupportRecentTicket } from "@/features/support/lib/support-types";

const TICKET_STATUSES = new Set<SupportRecentTicket["status"]>(["open", "pending", "resolved"]);

export function supportTicketStatusLabel(status: SupportRecentTicket["status"]): string {
  switch (status) {
    case "open":
      return "Open";
    case "pending":
      return "In progress";
    case "resolved":
      return "Resolved";
    default:
      return status;
  }
}

function parseTicketStatus(value: unknown): SupportRecentTicket["status"] | null {
  if (typeof value !== "string") return null;
  return TICKET_STATUSES.has(value as SupportRecentTicket["status"])
    ? (value as SupportRecentTicket["status"])
    : null;
}

export type SupportTicketListPatchResult = {
  tickets: SupportRecentTicket[];
  changed: boolean;
  needsRefetch: boolean;
};

export function patchSupportTicketListFromRealtime(
  tickets: SupportRecentTicket[],
  event: SupportRealtimeEvent,
): SupportTicketListPatchResult {
  const ticketId = event.ticket_id;
  if (!ticketId) {
    return { tickets, changed: false, needsRefetch: false };
  }

  const idx = tickets.findIndex((row) => row.id === ticketId);
  if (idx === -1) {
    return { tickets, changed: false, needsRefetch: true };
  }

  if (event.type === "conversation:locked") {
    const next = [...tickets];
    next[idx] = {
      ...next[idx],
      status: "resolved",
      statusLabel: supportTicketStatusLabel("resolved"),
      updatedAt: new Date().toISOString(),
    };
    return { tickets: next, changed: true, needsRefetch: false };
  }

  if (event.type === "ticket:updated") {
    const status = parseTicketStatus(event.ticket_status);
    if (!status) {
      return { tickets, changed: false, needsRefetch: false };
    }
    const next = [...tickets];
    next[idx] = {
      ...next[idx],
      status,
      statusLabel: supportTicketStatusLabel(status),
      updatedAt: new Date().toISOString(),
    };
    return { tickets: next, changed: true, needsRefetch: false };
  }

  return { tickets, changed: false, needsRefetch: false };
}
