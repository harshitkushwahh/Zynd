import { apiRequest } from "@/lib/api-client";
import type { DistributorOrder, OrderStatus } from "@/lib/distributor-types";

export type SupportTransactionMetrics = {
  totalTransactions: number;
  inProgress: number;
  completed: number;
  failed: number;
  volumeInr: number;
};

export type SupportTransactionsPage = {
  items: DistributorOrder[];
  hasMore: boolean;
  nextOffset: number;
  totalCount: number;
  metrics: SupportTransactionMetrics | null;
};

type ApiTransactionsResponse = {
  items: Array<{
    id: string;
    order_ref: string;
    client_code: string;
    investor_email_masked: string;
    scheme_name: string;
    order_type: string;
    amount_inr: number;
    status: string;
    raw_status: string;
    created_at: string | null;
    fp_purchase_id: string | null;
  }>;
  has_more: boolean;
  next_offset: number;
  total_count: number;
  metrics: {
    total_transactions: number;
    in_progress: number;
    completed: number;
    failed: number;
    volume_inr: number;
  } | null;
};

function mapOrderStatus(raw: string): OrderStatus {
  if (raw === "Completed") return "Completed";
  if (raw === "Failed") return "Failed";
  if (raw === "Pending") return "Pending";
  return "Processing";
}

function mapOrderType(raw: string): DistributorOrder["orderType"] {
  if (raw === "Redeem") return "Redeem";
  if (raw === "Switch") return "Switch";
  return "Purchase";
}

function mapTransactionRow(row: ApiTransactionsResponse["items"][number]): DistributorOrder {
  return {
    id: row.id,
    orderRef: row.order_ref,
    investorEmailMasked: row.investor_email_masked,
    clientCode: row.client_code,
    schemeName: row.scheme_name,
    orderType: mapOrderType(row.order_type),
    amount: row.amount_inr,
    status: mapOrderStatus(row.status),
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export async function fetchSupportTransactionsPage(params?: {
  search?: string;
  status?: OrderStatus | "all";
  orderType?: DistributorOrder["orderType"] | "all";
  limit?: number;
  offset?: number;
}): Promise<SupportTransactionsPage> {
  const search = new URLSearchParams();
  if (params?.search?.trim()) search.set("search", params.search.trim());
  if (params?.status && params.status !== "all") search.set("status", params.status);
  if (params?.orderType && params.orderType !== "all") {
    search.set("order_type", params.orderType);
  }
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const query = search.toString();
  const path = query ? `/support/console/transactions?${query}` : "/support/console/transactions";
  const response = await apiRequest<ApiTransactionsResponse>(path);
  return {
    items: response.items.map(mapTransactionRow),
    hasMore: response.has_more,
    nextOffset: response.next_offset,
    totalCount: response.total_count,
    metrics: response.metrics
      ? {
          totalTransactions: response.metrics.total_transactions,
          inProgress: response.metrics.in_progress,
          completed: response.metrics.completed,
          failed: response.metrics.failed,
          volumeInr: response.metrics.volume_inr,
        }
      : null,
  };
}
