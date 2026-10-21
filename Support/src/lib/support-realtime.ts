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

export function emitMessagesRead(
  send: (payload: object) => void,
  input: {
    conversationId?: string | null;
    ticketId?: string | null;
    messageIds: string[];
  },
) {
  if (!input.messageIds.length) return;
  if (!input.conversationId && !input.ticketId) return;
  send({
    type: "messages:read",
    conversation_id: input.conversationId ?? undefined,
    ticket_id: input.ticketId ?? undefined,
    message_ids: input.messageIds,
  });
}
