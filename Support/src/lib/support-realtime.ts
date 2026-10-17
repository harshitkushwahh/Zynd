import {
  connectSupportRealtime,
  type SupportRealtimeEvent,
  type SupportRealtimeHandlers,
} from "@zynd/shared/api";

export type { SupportRealtimeEvent, SupportRealtimeHandlers };
export { connectSupportRealtime };

export function emitAgentPresence(send: (payload: object) => void, status: "online" | "away") {
  send({ type: "agent:presence", status });
}

export function emitAgentTyping(send: (payload: object) => void, ticketId: string, typing: boolean) {
  send({ type: "agent:typing", ticket_id: ticketId, typing });
}

export function subscribeSupportTicket(send: (payload: object) => void, ticketId: string) {
  send({ type: "subscribe", ticket_id: ticketId });
}
