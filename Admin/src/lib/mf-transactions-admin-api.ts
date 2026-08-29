import { apiRequest } from "@/lib/api-client";

export type MfTransactionOverview = {
  order_counts: Record<string, number>;
  stuck_orders: number;
  stuck_checkouts: number;
  stuck_mandates: number;
  stuck_sip_plans: number;
  failed_orders_24h: number;
  failed_webhooks_24h: number;
  stuck_threshold_minutes: number;
  payment_expiry_minutes: number;
};

export type MfTransactionOrder = {
  order_id: string;
  status: string;
  amount_inr: number;
  order_type?: string;
  product_name?: string | null;
  product_id?: string;
  amc_logo_url?: string | null;
  checkout_id?: string | null;
  user_id?: string;
  client_id?: string | null;
  user_email?: string | null;
  user_display_name?: string | null;
  user_profile_image_url?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
  settled_at?: string | null;
  failure_code?: string | null;
  failure_reason?: string | null;
  fp_purchase_id?: string | null;
  fp_state?: string | null;
  payment_url?: string | null;
  next_action?: string | null;
  payment_method?: string | null;
  fp_purchase_old_id?: string | null;
  product_slug?: string | null;
  amc_name?: string | null;
};

export type MfTransactionOrderEvent = {
  from_status?: string | null;
  to_status: string;
  source: string;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type MfTransactionOrderDetail = {
  order: MfTransactionOrder;
  events: MfTransactionOrderEvent[];
};

export type MfTransactionSipMandate = {
  mandate_id: string;
  status: string;
  mandate_type: string;
  mandate_limit?: number | null;
  fp_mandate_id?: number | null;
  fp_mandate_status?: string | null;
  next_action?: string | null;
  bank_name?: string | null;
  bank_account_masked?: string | null;
  bank_ifsc_code?: string | null;
  created_at?: string | null;
  approved_at?: string | null;
};

export type MfTransactionSipPlan = {
  plan_id: string;
  product_id: string;
  product_name?: string | null;
  amount_inr: number;
  frequency: string;
  installment_day?: number | null;
  number_of_installments: number;
  status: string;
  fp_plan_id?: string | null;
  fp_state?: string | null;
  next_installment_date?: string | null;
  next_action?: string | null;
  failure_code?: string | null;
  failure_reason?: string | null;
  created_at?: string | null;
  activated_at?: string | null;
  user_id?: string;
  client_id?: string | null;
  user_email?: string | null;
  user_display_name?: string | null;
  user_profile_image_url?: string | null;
  amc_name?: string | null;
  amc_logo_url?: string | null;
  isin?: string | null;
  mandate?: MfTransactionSipMandate | null;
  first_installment?: Record<string, unknown> | null;
  bank_switch?: {
    eligible?: boolean;
    used?: boolean;
    in_progress?: boolean;
    reason?: string | null;
  } | null;
};

export type MfTransactionSipPlanEvent = {
  from_status?: string | null;
  to_status: string;
  source: string;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type MfTransactionSipPlanDetail = {
  plan: MfTransactionSipPlan;
  events: MfTransactionSipPlanEvent[];
};

export type MfSipPlanCounts = {
  total: number;
  active: number;
  working: number;
  cancelled: number;
  failed: number;
};

export type MfTransactionMandate = {
  mandate_id: string;
  status: string;
  fp_mandate_id?: number | null;
  bank_account_old_id: number;
  mandate_type: string;
  mandate_limit: number;
  fp_mandate_status?: string | null;
  auth_url?: string | null;
  next_action?: string | null;
  failure_code?: string | null;
  failure_reason?: string | null;
  created_at?: string | null;
  approved_at?: string | null;
  user_id?: string;
  client_id?: string | null;
  user_email?: string | null;
  user_display_name?: string | null;
  user_profile_image_url?: string | null;
  sip_plan_counts: MfSipPlanCounts;
};

export type MfTransactionMandateDetail = MfTransactionMandate & {
  sip_plans: MfTransactionSipPlan[];
};

export type MfTransactionMandateList = {
  mandates: MfTransactionMandate[];
  summary: {
    total_mandates: number;
    active_mandates: number;
    auth_pending_mandates: number;
  };
};

export type MfTransactionWebhookEvent = {
  event_id: number;
  fp_event_id?: string | null;
  event_type: string;
  processing_status: string;
  processing_error?: string | null;
  received_at?: string | null;
  processed_at?: string | null;
};

export type MfTransactionCheckoutOrder = {
  order_id: string;
  product_id: string;
  product_name?: string | null;
  amount_inr: number;
  status: string;
  order_type?: string;
  line_index?: number;
  fp_state?: string | null;
  amc_logo_url?: string | null;
};

export type MfTransactionCheckout = {
  checkout_id: string;
  checkout_type: string;
  status: string;
  total_amount_inr: number;
  payment_url?: string | null;
  next_action?: string | null;
  fp_payment_id?: number | null;
  failure_code?: string | null;
  failure_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  order_count: number;
  lumpsum_item_count: number;
  sip_item_count: number;
  orders: MfTransactionCheckoutOrder[];
  user_id?: string;
  client_id?: string | null;
  user_email?: string | null;
  user_display_name?: string | null;
  user_profile_image_url?: string | null;
  payout_bank_account_id?: string | null;
  payout_bank_account_masked?: string | null;
  payout_bank_ifsc_code?: string | null;
  payout_bank_name?: string | null;
};

export type MfTransactionSipBatch = {
  batch_id: string;
  mandate_id: string;
  mandate_status: string;
  plan_count: number;
  total_amount_inr: number;
  auth_url?: string | null;
  next_action?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  plans: MfTransactionSipPlan[];
  user_id?: string;
  client_id?: string | null;
  user_email?: string | null;
  user_display_name?: string | null;
  user_profile_image_url?: string | null;
  sip_plan_counts?: MfSipPlanCounts;
};

export async function fetchMfTransactionOverview() {
  return apiRequest<MfTransactionOverview>("/admin/mf/transactions/overview");
}

export async function fetchMfTransactionOrders(params?: {
  status?: string;
  order_type?: string;
  checkout_type?: string;
  user_id?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.order_type) search.set("order_type", params.order_type);
  if (params?.checkout_type) search.set("checkout_type", params.checkout_type);
  if (params?.user_id) search.set("user_id", params.user_id);
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiRequest<{ orders: MfTransactionOrder[] }>(
    `/admin/mf/transactions/orders${query ? `?${query}` : ""}`
  );
}

export async function fetchMfTransactionOrderDetail(orderId: string) {
  return apiRequest<MfTransactionOrderDetail>(`/admin/mf/transactions/orders/${orderId}`);
}

export async function fetchMfTransactionSipPlanDetail(planId: string) {
  return apiRequest<MfTransactionSipPlanDetail>(`/admin/mf/transactions/sip-plans/${planId}`);
}

export async function fetchMfTransactionSipPlans(params?: {
  status?: string;
  user_id?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.user_id) search.set("user_id", params.user_id);
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiRequest<{ plans: MfTransactionSipPlan[] }>(
    `/admin/mf/transactions/sip-plans${query ? `?${query}` : ""}`
  );
}

export async function fetchMfTransactionMandates(params?: {
  status?: string;
  user_id?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.user_id) search.set("user_id", params.user_id);
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiRequest<MfTransactionMandateList>(
    `/admin/mf/transactions/mandates${query ? `?${query}` : ""}`
  );
}

export async function fetchMfTransactionMandateDetail(mandateId: string) {
  return apiRequest<MfTransactionMandateDetail>(`/admin/mf/transactions/mandates/${mandateId}`);
}

export async function fetchMfTransactionWebhooks(params?: {
  processing_status?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.processing_status) search.set("processing_status", params.processing_status);
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiRequest<{ events: MfTransactionWebhookEvent[] }>(
    `/admin/mf/transactions/webhooks${query ? `?${query}` : ""}`
  );
}

export async function fetchMfTransactionCheckouts(params?: {
  checkout_type?: string;
  status?: string;
  user_id?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.checkout_type) search.set("checkout_type", params.checkout_type);
  if (params?.status) search.set("status", params.status);
  if (params?.user_id) search.set("user_id", params.user_id);
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiRequest<{ checkouts: MfTransactionCheckout[] }>(
    `/admin/mf/transactions/checkouts${query ? `?${query}` : ""}`
  );
}

export async function fetchMfTransactionCheckoutDetail(checkoutId: string) {
  return apiRequest<MfTransactionCheckout>(`/admin/mf/transactions/checkouts/${checkoutId}`);
}

export async function fetchMfTransactionSipBatches(params?: {
  status?: string;
  user_id?: string;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.user_id) search.set("user_id", params.user_id);
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiRequest<{ batches: MfTransactionSipBatch[] }>(
    `/admin/mf/transactions/sip-batches${query ? `?${query}` : ""}`
  );
}

export async function syncMfTransactionOrder(orderId: string) {
  return apiRequest<{ synced?: boolean; advanced?: boolean; order?: MfTransactionOrder }>(
    `/admin/mf/transactions/orders/${orderId}/sync`,
    { method: "POST" }
  );
}

export async function syncMfTransactionSipPlan(planId: string) {
  return apiRequest<{ advanced?: boolean; plan?: MfTransactionSipPlan }>(
    `/admin/mf/transactions/sip-plans/${planId}/sync`,
    { method: "POST" }
  );
}

export async function syncMfTransactionMandate(mandateId: string) {
  return apiRequest<{ synced?: boolean; mandate?: MfTransactionMandate }>(
    `/admin/mf/transactions/mandates/${mandateId}/sync`,
    { method: "POST" }
  );
}

export async function replayMfTransactionWebhook(eventId: number) {
  return apiRequest<{ status: string; event_id: number; event_type: string; handled: boolean }>(
    `/admin/mf/transactions/webhooks/${eventId}/replay`,
    { method: "POST" }
  );
}

export async function expireStaleMfCheckouts() {
  return apiRequest<{ expired_checkouts?: number }>("/admin/mf/transactions/expire-stale", {
    method: "POST",
  });
}
