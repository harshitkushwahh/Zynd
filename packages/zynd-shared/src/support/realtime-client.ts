import { getAccessToken } from "../api/client";
import { getSupportWebSocketUrl } from "../api/support-ws-url";

export type SupportRealtimeEvent = {
  type: string;
  conversation_id?: string;
  ticket_id?: string;
  message?: Record<string, unknown>;
  typing?: boolean;
  handler?: string;
  participant?: string;
  ticket_status?: string;
  assignee_name?: string | null;
  agent_presence?: string | null;
  resolution_open?: boolean;
  status?: string;
  owner_user_id?: string;
  message_id?: string;
  side?: "customer" | "support";
  read_at?: string;
  support_read_by?: "bot" | "agent";
};

export type SupportRealtimeHandlers = {
  onEvent: (event: SupportRealtimeEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
  onReady?: (send: (payload: object) => void) => void;
};

type SharedSupportRealtime = {
  ws: WebSocket | null;
  token: string | null;
  closed: boolean;
  opening: boolean;
  retryMs: number;
  retryTimer: number | null;
  listeners: Set<SupportRealtimeHandlers>;
};

const shared: SharedSupportRealtime = {
  ws: null,
  token: null,
  closed: false,
  opening: false,
  retryMs: 1000,
  retryTimer: null,
  listeners: new Set(),
};

function sendPayload(payload: object) {
  if (shared.ws?.readyState === WebSocket.OPEN) {
    shared.ws.send(JSON.stringify(payload));
  }
}

function notifyConnection(connected: boolean) {
  for (const listener of shared.listeners) {
    listener.onConnectionChange?.(connected);
  }
}

function notifyReady() {
  for (const listener of shared.listeners) {
    listener.onReady?.(sendPayload);
  }
}

function teardownSocket() {
  if (shared.retryTimer !== null) {
    window.clearTimeout(shared.retryTimer);
    shared.retryTimer = null;
  }
  shared.opening = false;
  shared.ws?.close();
  shared.ws = null;
}

function scheduleReconnect() {
  if (shared.closed || shared.listeners.size === 0) return;
  if (shared.retryTimer !== null) return;
  shared.retryTimer = window.setTimeout(() => {
    shared.retryTimer = null;
    openSocket();
  }, shared.retryMs);
  shared.retryMs = Math.min(shared.retryMs * 2, 15000);
}

function openSocket() {
  const token = getAccessToken();
  if (!token || shared.closed || shared.listeners.size === 0) {
    return;
  }

  if (
    shared.ws &&
    shared.token === token &&
    (shared.ws.readyState === WebSocket.OPEN || shared.ws.readyState === WebSocket.CONNECTING)
  ) {
    if (shared.ws.readyState === WebSocket.OPEN) {
      notifyConnection(true);
      notifyReady();
    }
    return;
  }

  if (shared.opening) {
    return;
  }

  teardownSocket();
  shared.token = token;
  shared.retryMs = 1000;
  shared.opening = true;

  const ws = new WebSocket(getSupportWebSocketUrl(token));
  shared.ws = ws;

  ws.onopen = () => {
    shared.opening = false;
    if (shared.ws !== ws) return;
    shared.retryMs = 1000;
    notifyConnection(true);
    notifyReady();
  };

  ws.onclose = () => {
    shared.opening = false;
    if (shared.ws !== ws) return;
    shared.ws = null;
    notifyConnection(false);
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onmessage = (message) => {
    if (shared.ws !== ws) return;
    try {
      const event = JSON.parse(String(message.data)) as SupportRealtimeEvent;
      if (!event?.type) return;
      for (const listener of shared.listeners) {
        listener.onEvent(event);
      }
    } catch {
      // Ignore malformed frames.
    }
  };
}

/** One shared WebSocket per browser tab; fan-out to all subscribers. */
export function connectSupportRealtime(handlers: SupportRealtimeHandlers): () => void {
  const token = getAccessToken();
  if (!token) {
    handlers.onConnectionChange?.(false);
    return () => undefined;
  }

  shared.closed = false;
  shared.listeners.add(handlers);
  openSocket();

  return () => {
    shared.listeners.delete(handlers);
    handlers.onConnectionChange?.(false);
    if (shared.listeners.size === 0) {
      shared.closed = true;
      teardownSocket();
      shared.token = null;
    }
  };
}
