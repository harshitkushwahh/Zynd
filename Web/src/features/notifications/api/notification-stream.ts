import { getAccessToken, getApiUrl, refreshSession } from "@zynd/shared/api";

import type { NotificationCategory, NotificationItem } from "@/features/notifications/api/notifications-api";

export type NotificationStreamPayload = NotificationItem & {
  unread_count: number;
};

type NotificationStreamHandlers = {
  onConnected?: () => void;
  onNotification: (payload: NotificationStreamPayload) => void;
  onUnreadCount?: (unreadCount: number) => void;
  onDisconnect?: () => void;
};

const STREAM_PATH = "/notifications/stream";

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join("\n") };
}

function toNotificationItem(payload: NotificationStreamPayload): NotificationItem {
  return {
    id: payload.id,
    category: payload.category as NotificationCategory,
    notification_type: payload.notification_type,
    title: payload.title,
    body: payload.body,
    metadata: payload.metadata,
    read_at: payload.read_at,
    created_at: payload.created_at,
  };
}

export { toNotificationItem };

export async function connectNotificationStream(
  handlers: NotificationStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("missing_access_token");
  }

  let response = await fetch(`${getApiUrl()}${STREAM_PATH}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    credentials: "include",
    signal,
  });

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed.ok) {
      throw new Error("session_expired");
    }
    response = await fetch(`${getApiUrl()}${STREAM_PATH}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${refreshed.accessToken}`,
        Accept: "text/event-stream",
      },
      credentials: "include",
      signal,
    });
  }

  if (!response.ok || !response.body) {
    throw new Error(`stream_http_${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const parsed = parseSseBlock(block.trim());
      if (!parsed) {
        continue;
      }

      if (parsed.event === "connected") {
        handlers.onConnected?.();
        continue;
      }

      if (parsed.event === "heartbeat") {
        continue;
      }

      if (parsed.event === "notification.created") {
        const payload = JSON.parse(parsed.data) as NotificationStreamPayload;
        handlers.onNotification(payload);
        continue;
      }

      if (parsed.event === "unread.updated") {
        const payload = JSON.parse(parsed.data) as { unread_count: number };
        handlers.onUnreadCount?.(payload.unread_count);
      }
    }
  }

  handlers.onDisconnect?.();
}
