import { apiRequest, getAccessToken, getApiUrl } from "@/lib/api-client";
import {
  isResolutionPromptMessage,
  RESOLUTION_PROMPT_BODY,
} from "@/features/support/lib/support-resolution";
import type { SupportMessage, SupportRecentTicket } from "@/features/support/lib/support-types";

type ApiMessage = {
  id: string;
  role: "user" | "bot" | "agent" | "system";
  body: string;
  created_at: string;
  sender_name?: string | null;
  kind?: "text" | "resolution_prompt";
  attachment_document_id?: string | null;
  attachment_filename?: string | null;
  resolution_active?: boolean;
};

export type SupportConversationPayload = {
  id: string | null;
  status: string;
  handler: "bot" | "human";
  participant?: "bot" | "human";
  ticket_id: string | null;
  ticket_status?: "open" | "pending" | "resolved" | null;
  assignee_name?: string | null;
  agent_presence?: "online" | "away" | null;
  resolution_open?: boolean;
  messages: ApiMessage[];
};

export function isSupportThreadLocked(conversation: Pick<
  SupportConversationPayload,
  "status" | "ticket_status"
>): boolean {
  return conversation.status === "closed" || conversation.ticket_status === "resolved";
}

type ApiTicket = {
  id: string;
  subject: string;
  description: string;
  status: SupportRecentTicket["status"];
  updated_at: string;
};

const STATUS_LABELS: Record<SupportRecentTicket["status"], string> = {
  open: "Open",
  pending: "In progress",
  resolved: "Resolved",
};

export function mapConversationMessages(
  messages: ApiMessage[],
  options?: { resolutionOpen?: boolean },
): SupportMessage[] {
  const resolutionOpen = options?.resolutionOpen ?? false;
  const promptIds = messages.filter((message) => isResolutionPromptMessage(message)).map((message) => message.id);
  const latestPromptId = promptIds[promptIds.length - 1];

  return messages.map((message) => {
    const isPrompt = isResolutionPromptMessage(message);
    const isLatestPrompt = isPrompt && message.id === latestPromptId;
    const resolutionActive =
      Boolean(message.resolution_active) || (resolutionOpen && isLatestPrompt);

    return {
      id: message.id,
      role: message.role === "user" ? "user" : message.role === "system" ? "system" : "agent",
      body: isPrompt && !message.body.trim() ? RESOLUTION_PROMPT_BODY : message.body,
      createdAt: message.created_at,
      senderName: message.sender_name ?? undefined,
      kind: isPrompt ? "resolution_prompt" : (message.kind ?? "text"),
      resolutionActive: isPrompt ? resolutionActive : false,
      attachmentId: message.attachment_document_id ?? undefined,
      imageName: message.attachment_filename ?? undefined,
    };
  });
}

export function getCurrentSupportConversation() {
  return apiRequest<SupportConversationPayload>("/support/conversations/current");
}

/** Help Bot may call Ollama on CPU; keep below nginx/proxy limits (see Backend/docs). */
const SUPPORT_MESSAGE_TIMEOUT_MS = 180_000;

function withSupportMessageTimeout<T>(promise: Promise<T>): Promise<T> {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return promise;
  }
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("support_message_timeout"));
    }, SUPPORT_MESSAGE_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function postSupportMessage(body: string, file?: File | null) {
  const path = "/support/conversations/messages";
  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(SUPPORT_MESSAGE_TIMEOUT_MS)
      : undefined;

  if (file) {
    const form = new FormData();
    form.append("body", body);
    form.append("file", file);
    return withSupportMessageTimeout(
      apiRequest<SupportConversationPayload>(path, {
        method: "POST",
        body: form,
        signal,
      }),
    );
  }
  return withSupportMessageTimeout(
    apiRequest<SupportConversationPayload>(path, {
      method: "POST",
      body: JSON.stringify({ body }),
      signal,
    }),
  );
}

export function getSupportTicketThread(ticketId: string) {
  return apiRequest<SupportConversationPayload>(`/support/tickets/${encodeURIComponent(ticketId)}`);
}

export function respondSupportResolution(ticketId: string, choice: "yes" | "no") {
  return apiRequest<SupportConversationPayload>(
    `/support/tickets/${encodeURIComponent(ticketId)}/resolution`,
    {
      method: "POST",
      body: JSON.stringify({ choice }),
    },
  );
}

export async function fetchSupportAttachment(messageId: string): Promise<string> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${getApiUrl()}/support/messages/${messageId}/attachment`, {
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("attachment_unavailable");
  }
  return URL.createObjectURL(await response.blob());
}

export type HelpBotStatus = {
  ollama: "connected" | "unavailable";
  model: string;
};

export async function getHelpBotStatus(): Promise<HelpBotStatus> {
  return apiRequest<HelpBotStatus>("/support/help-bot/status");
}

export async function beginNewSupportConversation(): Promise<SupportConversationPayload> {
  return apiRequest<SupportConversationPayload>("/support/conversations/new", {
    method: "POST",
  });
}

export type SupportTicketListPage = {
  tickets: SupportRecentTicket[];
  hasMore: boolean;
  nextOffset: number;
};

function mapApiTickets(items: ApiTicket[]): SupportRecentTicket[] {
  return items.map((ticket) => ({
    id: ticket.id,
    status: ticket.status,
    statusLabel: STATUS_LABELS[ticket.status] ?? ticket.status,
    title: ticket.subject,
    description: ticket.description,
    updatedAt: ticket.updated_at,
  }));
}

export async function listMySupportTicketsPage(
  offset: number,
  limit: number,
): Promise<SupportTicketListPage> {
  const params = new URLSearchParams({
    offset: String(Math.max(0, offset)),
    limit: String(Math.max(1, limit)),
  });
  const payload = await apiRequest<{
    items: ApiTicket[];
    has_more: boolean;
    next_offset: number;
  }>(`/support/tickets?${params.toString()}`);
  return {
    tickets: mapApiTickets(payload.items),
    hasMore: payload.has_more,
    nextOffset: payload.next_offset,
  };
}
