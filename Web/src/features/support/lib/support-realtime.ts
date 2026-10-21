import {
  connectSupportRealtime,
  type SupportRealtimeEvent,
  type SupportRealtimeHandlers,
} from "@zynd/shared/api";

export type { SupportRealtimeEvent, SupportRealtimeHandlers };
export { connectSupportRealtime };

export function subscribeSupportConversation(
  wsConnected: boolean,
  send: (payload: object) => void,
  input: { conversationId?: string | null; ticketId?: string | null },
) {
  if (!wsConnected) return;
  if (!input.conversationId && !input.ticketId) return;
  send({
    type: "subscribe",
    conversation_id: input.conversationId ?? undefined,
    ticket_id: input.ticketId ?? undefined,
  });
}

export function emitMessagesRead(
  send: (payload: object) => void,
  input: {
    conversationId: string;
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

export function createSupportRealtimeSend(getSocket: () => WebSocket | null) {
  return (payload: object) => {
    const socket = getSocket();
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };
}
