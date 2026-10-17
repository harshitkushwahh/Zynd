import { apiRequest } from "@/lib/api-client";
import type {
  SupportKycQueueItem,
  SupportKycQueueStatus,
  SupportKycReviewType,
} from "@/lib/support-kyc-queue-dummy-data";

export type SupportKycQueueMetrics = {
  pendingReview: number;
  inProgress: number;
  escalated: number;
  approved: number;
  notStarted: number;
  totalInvestors: number;
};

export type SupportKycQueuePage = {
  items: SupportKycQueueItem[];
  hasMore: boolean;
  nextOffset: number;
  totalCount: number;
  metrics: SupportKycQueueMetrics | null;
};

type ApiKycQueueResponse = {
  items: Array<{
    id: string;
    client_code: string;
    display_name: string;
    email_masked: string;
    queue_status: string;
    review_type: string;
    submitted_at: string | null;
    priority: string;
    overall_status: string;
    partner_status?: string | null;
    cybrilla_form_type?: string | null;
  }>;
  has_more: boolean;
  next_offset: number;
  total_count: number;
  metrics: {
    pending_review: number;
    in_progress: number;
    escalated: number;
    approved: number;
    not_started: number;
    total_investors: number;
  } | null;
};

function mapQueueItem(row: ApiKycQueueResponse["items"][number]): SupportKycQueueItem {
  return {
    id: row.id,
    clientCode: row.client_code,
    displayName: row.display_name,
    emailMasked: row.email_masked,
    queueStatus: row.queue_status as SupportKycQueueStatus,
    reviewType: row.review_type as SupportKycReviewType,
    submittedAt: row.submitted_at ?? new Date(0).toISOString(),
    priority: row.priority === "High" ? "High" : "Normal",
    partnerStatus: row.partner_status,
    cybrillaFormType: row.cybrilla_form_type,
  };
}

export async function fetchSupportKycQueuePage(params?: {
  search?: string;
  queueStatus?: SupportKycQueueStatus | "all";
  reviewType?: SupportKycReviewType | "all";
  limit?: number;
  offset?: number;
}): Promise<SupportKycQueuePage> {
  const search = new URLSearchParams();
  if (params?.search?.trim()) search.set("search", params.search.trim());
  if (params?.queueStatus && params.queueStatus !== "all") {
    search.set("queue_status", params.queueStatus);
  }
  if (params?.reviewType && params.reviewType !== "all") {
    search.set("review_type", params.reviewType);
  }
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const query = search.toString();
  const path = query
    ? `/support/console/kyc-verifications?${query}`
    : "/support/console/kyc-verifications";
  const response = await apiRequest<ApiKycQueueResponse>(path);
  return {
    items: response.items.map(mapQueueItem),
    hasMore: response.has_more,
    nextOffset: response.next_offset,
    totalCount: response.total_count,
    metrics: response.metrics
      ? {
          pendingReview: response.metrics.pending_review,
          inProgress: response.metrics.in_progress,
          escalated: response.metrics.escalated,
          approved: response.metrics.approved,
          notStarted: response.metrics.not_started,
          totalInvestors: response.metrics.total_investors,
        }
      : null,
  };
}
