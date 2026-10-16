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

export function createSupportRealtimeSend(getSocket: () => WebSocket | null) {
  return (payload: object) => {
    const socket = getSocket();
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };
}
