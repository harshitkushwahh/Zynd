import { ApiError, apiRequest, getAccessToken } from "@/lib/api-client";
import { getApiUrl } from "@zynd/shared/api";
import { formatDistributorDate } from "@/lib/format";
import { buildSupportTicketDetail } from "@/lib/support-ticket-detail-model";
import type {
  SupportTicket,
  SupportTicketCustomerSnapshot,
  SupportTicketDetail,
  SupportTicketDomainContext,
  SupportTicketDomainStatusVariant,
  SupportTicketMessage,
} from "@/lib/support-types";

type ApiMessage = {
  id: string;
  role: SupportTicketMessage["role"];
  body: string;
  created_at: string;
  sender_name?: string | null;
  visibility?: "customer" | "internal";
  kind?: "text" | "resolution_prompt";
  resolution_active?: boolean;
  attachment_document_id?: string | null;
  attachment_filename?: string | null;
};

type ApiAttachment = {
  id: string;
  file_name?: string;
  fileName?: string;
};

type ApiTicket = {
  id: string;
  subject: string;
  description: string;
  topic: SupportTicket["topic"];
  status: SupportTicket["status"];
  priority: SupportTicket["priority"];
  user_id: string;
  assignee_id: string | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
  channel: SupportTicket["channel"];
  handled_by: "bot" | "human";
  messages?: ApiMessage[];
  attachments?: ApiAttachment[];
};

type ApiCustomer = {
  display_name: string;
  email_masked: string;
  mobile_masked: string;
  pan_masked: string;
  aadhaar_masked: string;
  kyc_status_label: string;
  kyc_compliant: boolean;
  client_type: string;
  onboarding_date: string | null;
};

type ApiDomain = {
  title: string;
  view_in_href?: string | null;
  view_in_label?: string | null;
  status_label: string;
  status_variant?: string | null;
  fields: Array<{ label: string; value: string }>;
};

type ApiTicketDetail = {
  ticket: ApiTicket;
  customer: ApiCustomer;
  domain: ApiDomain | null;
  recent_tickets: ApiTicket[];
};

export type SupportTicketQueue = "escalated" | "bot" | "all";

function mapMessage(message: ApiMessage): SupportTicketMessage {
  return {
    id: message.id,
    role: message.role,
    body: message.body,
    createdAt: message.created_at,
    senderName: message.sender_name ?? undefined,
    visibility: message.visibility,
    attachmentFileName: message.attachment_filename ?? undefined,
    kind: message.kind ?? "text",
    resolutionActive: Boolean(message.resolution_active),
  };
}

function mapTicket(ticket: ApiTicket): SupportTicket {
  return {
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    topic: ticket.topic,
    status: ticket.status,
    priority: ticket.priority,
    userId: ticket.user_id,
    assigneeId: ticket.assignee_id,
    assigneeName: ticket.assignee_name,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    channel: ticket.channel,
    handledBy: ticket.handled_by,
    messages: (ticket.messages ?? []).map(mapMessage),
    attachments: (ticket.attachments ?? []).map((item) => ({
      id: item.id,
      fileName: item.file_name || item.fileName || "Image",
    })),
  };
}

function mapCustomer(customer: ApiCustomer): SupportTicketCustomerSnapshot {
  return {
    displayName: customer.display_name,
    emailMasked: customer.email_masked,
    mobileMasked: customer.mobile_masked,
    panMasked: customer.pan_masked,
    aadhaarMasked: customer.aadhaar_masked,
    kycStatusLabel: customer.kyc_status_label,
    kycCompliant: customer.kyc_compliant,
    clientType: customer.client_type,
    onboardingDate: customer.onboarding_date
      ? formatDistributorDate(customer.onboarding_date)
      : "—",
  };
}

function mapDomain(domain: ApiDomain | null): SupportTicketDomainContext | null {
  if (!domain) return null;
  const variant = domain.status_variant;
  const statusVariant: SupportTicketDomainStatusVariant | undefined =
    variant === "success" ||
    variant === "warning" ||
    variant === "destructive" ||
    variant === "info" ||
    variant === "neutral"
      ? variant
      : "info";
  return {
    title: domain.title,
    viewInHref: domain.view_in_href ?? undefined,
    viewInLabel: domain.view_in_label ?? undefined,
    statusLabel: domain.status_label,
    statusVariant,
    fields: domain.fields,
  };
}

export function listSupportTickets(options?: {
  clientId?: string;
  queue?: SupportTicketQueue;
}): Promise<SupportTicket[]> {
  const params = new URLSearchParams();
  params.set("queue", options?.queue ?? (options?.clientId ? "all" : "escalated"));
  if (options?.clientId?.trim()) {
    params.set("client_id", options.clientId.trim());
  }
  return apiRequest<{ items: ApiTicket[] }>(`/support/console/tickets?${params.toString()}`).then(
    (payload) => payload.items.map(mapTicket),
  );
}

export function fetchSupportTicketDetail(ticketId: string): Promise<SupportTicketDetail> {
  return apiRequest<ApiTicketDetail>(
    `/support/console/tickets/${encodeURIComponent(ticketId.trim())}`,
  ).then((payload) =>
    buildSupportTicketDetail(mapTicket(payload.ticket), {
      customer: mapCustomer(payload.customer),
      recentTickets: payload.recent_tickets.map(mapTicket),
      domain: mapDomain(payload.domain),
    }),
  );
}

export function replyToSupportTicket(
  ticketId: string,
  body: string,
  visibility: "customer" | "internal",
  resolutionPrompt = false,
): Promise<SupportTicketDetail> {
  return apiRequest<ApiTicketDetail>(
    `/support/console/tickets/${encodeURIComponent(ticketId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        body,
        visibility,
        resolution_prompt: resolutionPrompt,
      }),
    },
  ).then((payload) =>
    buildSupportTicketDetail(mapTicket(payload.ticket), {
      customer: mapCustomer(payload.customer),
      recentTickets: payload.recent_tickets.map(mapTicket),
      domain: mapDomain(payload.domain),
    }),
  );
}

export function updateSupportTicket(
  ticketId: string,
  patch: { status?: SupportTicket["status"]; assignToSelf?: boolean },
): Promise<SupportTicketDetail> {
  return apiRequest<ApiTicketDetail>(`/support/console/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: patch.status ?? null,
      assign_to_self: Boolean(patch.assignToSelf),
    }),
  }).then((payload) =>
    buildSupportTicketDetail(mapTicket(payload.ticket), {
      customer: mapCustomer(payload.customer),
      recentTickets: payload.recent_tickets.map(mapTicket),
      domain: mapDomain(payload.domain),
    }),
  );
}

/** @deprecated Use fetchSupportTicketDetail */
export function fetchSupportTicket(ticketId: string): Promise<SupportTicket> {
  return fetchSupportTicketDetail(ticketId).then((detail) => detail.ticket);
}

export async function fetchSupportAttachmentBlob(messageId: string): Promise<Blob> {
  const headers = new Headers();
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(
    `${getApiUrl()}/support/console/messages/${messageId}/attachment`,
    { headers, credentials: "include" },
  );
  if (!response.ok) {
    throw new Error("attachment_unavailable");
  }
  return response.blob();
}

export function isSupportTicketNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
