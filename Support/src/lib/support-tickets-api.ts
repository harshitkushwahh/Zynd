import { ApiError, apiRequest, getAccessToken } from "@/lib/api-client";
import { getApiUrl } from "@zynd/shared/api";
import { formatDistributorDate } from "@/lib/format";
import { normalizeSupportDisplayValue } from "@/lib/support-display-value";
import { buildSupportTicketDetail } from "@/lib/support-ticket-detail-model";
import type {
  SupportTicket,
  SupportTicketCustomerSnapshot,
  SupportTicketDetail,
  SupportTicketDomainContext,
  SupportTicketDomainStatusVariant,
  SupportTicketLinkedRecord,
  SupportTicketMessage,
  SupportTicketPmCoHandling,
  SupportTicketRoutingInsight,
  SupportTicketSlaSnapshot,
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

type ApiTicketSla = {
  priority: SupportTicket["priority"];
  first_response_target_hours: number;
  resolution_target_hours: number;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  first_response_met: boolean;
  resolution_met: boolean;
  first_response_remaining_hours: number | null;
  resolution_remaining_hours: number | null;
};

type ApiLinkedRecord = {
  key: string;
  title: string;
  record_id: string;
  href?: string | null;
  status_label?: string | null;
  description: string;
  api_route: string;
  data_points: string[];
};

type ApiRouting = {
  urgency_score?: number | null;
  reason_summary?: string | null;
  priority_rationale?: string | null;
  sla_rationale?: string | null;
  assignee_rationale?: string | null;
  pm_co_handling?: SupportTicketPmCoHandling | null;
  signals?: string[];
  source?: string | null;
  model?: string | null;
  computed_at?: string | null;
  first_response_hours?: number | null;
  resolution_hours?: number | null;
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
  first_response_due_at?: string | null;
  resolution_due_at?: string | null;
  first_responded_at?: string | null;
  resolved_at?: string | null;
  sla?: ApiTicketSla;
  routing?: ApiRouting | null;
  urgency_score?: number | null;
  messages?: ApiMessage[];
  attachments?: ApiAttachment[];
};

type ApiCustomer = {
  display_name: string;
  email_masked: string | null;
  mobile_masked: string | null;
  pan_masked: string | null;
  aadhaar_masked: string | null;
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
  fields: Array<{ label: string; value: string | null }>;
};

type ApiTicketDetail = {
  ticket: ApiTicket;
  customer: ApiCustomer;
  domain: ApiDomain | null;
  linked_records?: ApiLinkedRecord[];
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

function mapSlaSnapshot(sla: ApiTicketSla | undefined): SupportTicketSlaSnapshot | undefined {
  if (!sla) return undefined;
  return {
    priority: sla.priority,
    firstResponseTargetHours: sla.first_response_target_hours,
    resolutionTargetHours: sla.resolution_target_hours,
    firstResponseDueAt: sla.first_response_due_at,
    resolutionDueAt: sla.resolution_due_at,
    firstRespondedAt: sla.first_responded_at,
    resolvedAt: sla.resolved_at,
    firstResponseMet: sla.first_response_met,
    resolutionMet: sla.resolution_met,
    firstResponseRemainingHours: sla.first_response_remaining_hours,
    resolutionRemainingHours: sla.resolution_remaining_hours,
  };
}

function mapPmCoHandling(raw: Record<string, unknown> | null | undefined): SupportTicketPmCoHandling | null {
  if (!raw || typeof raw !== "object") return null;
  return {
    recommendedAction: (raw.recommended_action as string | undefined) ?? undefined,
    reason: (raw.reason as string | undefined) ?? undefined,
    mitraUserId: (raw.mitra_user_id as string | undefined) ?? undefined,
    mitraDisplayName: (raw.mitra_display_name as string | undefined) ?? undefined,
    mitraClientId: (raw.mitra_client_id as string | undefined) ?? undefined,
  };
}

function mapRoutingInsight(routing: ApiRouting | null | undefined): SupportTicketRoutingInsight | null {
  if (!routing) return null;
  const pmRaw = routing.pm_co_handling as Record<string, unknown> | null | undefined;
  return {
    urgencyScore: routing.urgency_score ?? null,
    reasonSummary: routing.reason_summary ?? null,
    priorityRationale: routing.priority_rationale ?? null,
    slaRationale: routing.sla_rationale ?? null,
    assigneeRationale: routing.assignee_rationale ?? null,
    pmCoHandling: mapPmCoHandling(pmRaw),
    signals: routing.signals ?? [],
    source: routing.source ?? null,
    model: routing.model ?? null,
    computedAt: routing.computed_at ?? null,
    firstResponseHours: routing.first_response_hours ?? null,
    resolutionHours: routing.resolution_hours ?? null,
  };
}

function mapLinkedRecord(record: ApiLinkedRecord): SupportTicketLinkedRecord {
  return {
    key: record.key,
    title: record.title,
    recordId: record.record_id,
    href: record.href ?? undefined,
    statusLabel: record.status_label ?? undefined,
    description: record.description,
    apiRoute: record.api_route,
    dataPoints: record.data_points,
  };
}

function mapTicketDetailOptions(payload: ApiTicketDetail) {
  return {
    customer: mapCustomer(payload.customer),
    recentTickets: payload.recent_tickets.map(mapTicket),
    domain: mapDomain(payload.domain),
    linkedRecords: payload.linked_records?.map(mapLinkedRecord),
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
    firstResponseDueAt: ticket.first_response_due_at,
    resolutionDueAt: ticket.resolution_due_at,
    firstRespondedAt: ticket.first_responded_at,
    resolvedAt: ticket.resolved_at,
    sla: mapSlaSnapshot(ticket.sla),
    routing: mapRoutingInsight(ticket.routing),
    urgencyScore: ticket.urgency_score ?? null,
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
    emailMasked: normalizeSupportDisplayValue(customer.email_masked),
    mobileMasked: normalizeSupportDisplayValue(customer.mobile_masked),
    panMasked: normalizeSupportDisplayValue(customer.pan_masked),
    aadhaarMasked: normalizeSupportDisplayValue(customer.aadhaar_masked),
    kycStatusLabel: customer.kyc_status_label,
    kycCompliant: customer.kyc_compliant,
    clientType: customer.client_type,
    onboardingDate: customer.onboarding_date
      ? formatDistributorDate(customer.onboarding_date)
      : normalizeSupportDisplayValue(null),
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
    fields: domain.fields.map((field) => ({
      label: field.label,
      value: normalizeSupportDisplayValue(field.value),
    })),
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
    buildSupportTicketDetail(mapTicket(payload.ticket), mapTicketDetailOptions(payload)),
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
    buildSupportTicketDetail(mapTicket(payload.ticket), mapTicketDetailOptions(payload)),
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
