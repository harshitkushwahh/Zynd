"use client";

import { useEffect, useRef, useState } from "react";

import {
  connectSupportRealtime,
  emitAgentPresence,
  emitAgentTyping,
  subscribeSupportTicket,
  type SupportRealtimeEvent,
} from "@/lib/support-realtime";

type UseSupportTicketRealtimeOptions = {
  ticketId: string;
  enabled?: boolean;
  onEvent?: (event: SupportRealtimeEvent) => void;
};

export function useSupportTicketRealtime({
  ticketId,
  enabled = true,
  onEvent,
}: UseSupportTicketRealtimeOptions) {
  const [wsConnected, setWsConnected] = useState(false);
  const sendRef = useRef<(payload: object) => void>(() => undefined);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !ticketId.trim()) return;
    const disconnect = connectSupportRealtime({
      onConnectionChange: setWsConnected,
      onEvent: (event) => onEventRef.current?.(event),
      onReady: (send) => {
        sendRef.current = send;
        subscribeSupportTicket(send, ticketId);
        emitAgentPresence(send, "online");
      },
    });
    return disconnect;
  }, [enabled, ticketId]);

  useEffect(() => {
    if (!wsConnected || !enabled) return;
    const timer = window.setInterval(() => {
      emitAgentPresence(sendRef.current, "online");
    }, 25_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        emitAgentPresence(sendRef.current, "online");
      } else {
        emitAgentPresence(sendRef.current, "away");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      emitAgentPresence(sendRef.current, "away");
    };
  }, [enabled, wsConnected]);

  const notifyTyping = (typing: boolean) => {
    emitAgentTyping(sendRef.current, ticketId, typing);
  };

  return { wsConnected, notifyTyping };
}
