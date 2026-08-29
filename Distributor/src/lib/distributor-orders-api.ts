import { apiRequest } from "@/lib/api-client";
import type { DistributorOrder, OrderStatus } from "@/lib/distributor-types";

export type ApiDistributorOrderListItem = {
  order_id: string;
  fp_purchase_id: string | null;
  client_user_id: string;
  client_code: string | null;
  client_email_masked: string | null;
  product_name: string | null;
  amc_name?: string | null;
  amc_slug?: string | null;
  amc_logo_url?: string | null;
  order_type: string;
  amount_inr: number;
  status: string;
  created_at: string | null;
  in_distributor_book?: boolean;
};

type ApiDistributorOrderListResponse = {
  items: ApiDistributorOrderListItem[];
};

function mapOrderStatus(raw: string): OrderStatus {
  const normalized = raw.toUpperCase();
  if (normalized === "SUCCEEDED") return "Completed";
  if (normalized === "FAILED" || normalized === "CANCELLED") return "Failed";
  if (
    normalized === "PROCESSING" ||
    normalized === "SUBMITTED" ||
    normalized === "PAYMENT_PENDING"
  ) {
    return "Processing";
  }
  return "Pending";
}

function mapOrderType(raw: string): DistributorOrder["orderType"] {
  if (raw.toUpperCase() === "REDEMPTION") return "Redeem";
  return "Purchase";
}

function mapOperationChannel(raw: string): DistributorOrder["operationChannel"] {
  if (raw.toUpperCase() === "REDEMPTION") return "redemption";
  if (raw.toUpperCase() === "SIP") return "sip";
  return "one-time";
}

export function mapApiDistributorOrder(row: ApiDistributorOrderListItem): DistributorOrder {
  return {
    id: row.order_id,
    orderRef: row.fp_purchase_id ?? row.order_id.slice(0, 8).toUpperCase(),
    investorEmailMasked: row.client_email_masked ?? "—",
    clientCode: row.client_code ?? "—",
    schemeName: row.product_name ?? "Mutual fund",
    amcName: row.amc_name ?? null,
    amcSlug: row.amc_slug ?? null,
    amcLogoUrl: row.amc_logo_url ?? null,
    orderType: mapOrderType(row.order_type),
    amount: row.amount_inr,
    status: mapOrderStatus(row.status),
    createdAt: row.created_at ?? new Date().toISOString(),
    inDistributorBook: row.in_distributor_book ?? true,
    operationChannel: mapOperationChannel(row.order_type),
  };
}

export async function fetchDistributorOrders(options?: {
  scope?: "book" | "all";
  limit?: number;
  offset?: number;
}): Promise<DistributorOrder[]> {
  const scope = options?.scope === "all" ? "all" : "book";
  const params = new URLSearchParams({
    scope,
    limit: String(options?.limit ?? 100),
    offset: String(options?.offset ?? 0),
  });
  const response = await apiRequest<ApiDistributorOrderListResponse>(
    `/distributor/orders?${params.toString()}`,
  );
  return response.items.map(mapApiDistributorOrder);
}
