import { apiRequest } from "@/lib/api-client";

export type MfCatalogOverview = {
  total_funds: number;
  total_products: number;
  active_products: number;
  empanelled_amcs: number;
  total_amcs: number;
  total_categories: number;
  nav_rows: number;
};

export type MfCategoryAdmin = {
  id: number;
  slug: string;
  name: string;
  fund_count: number;
  active_fund_count: number;
  display_order: number;
  is_visible: boolean;
  min_funds_to_show: number;
};

export type MfCategoryFundCuration = {
  product_id: string;
  fund_id: number;
  scheme_name: string;
  isin: string | null;
  amc_id: number;
  amc_name: string;
  lifecycle_status: string;
  display_order: number | null;
  is_featured: boolean;
  featured_rank: number | null;
  effective_from: string | null;
  effective_until: string | null;
  return_3y: number | null;
  rank_position: number | null;
  amc_logo_url: string | null;
};

export type MfCategoryFundsCuration = {
  category: MfCategoryAdmin;
  items: MfCategoryFundCuration[];
};

export type MfFundAdmin = {
  fund_id: number;
  product_id: string | null;
  product_code: string | null;
  scheme_name: string;
  isin: string | null;
  scheme_code: string | null;
  amc_id: number;
  amc_name: string;
  amc_slug: string;
  amc_logo_url: string | null;
  amc_empanelled: boolean;
  category_slug: string | null;
  category_name: string | null;
  lifecycle_status: string | null;
  fund_active: boolean;
  fp_oms_purchase_allowed: boolean | null;
  fp_oms_active: boolean | null;
  fp_scheme_id: string | null;
  sebi_category: string | null;
  min_sip_amount_inr: number | null;
  min_lumpsum_amount_inr: number | null;
  return_3y: number | null;
  rank_position: number | null;
  latest_nav: number | null;
  latest_nav_date: string | null;
  nav_row_count: number | null;
  catalog_flags: string[];
  health_flags: string[];
  admin_visibility: string | null;
  admin_investability: string | null;
  disabled_reason: string | null;
  disabled_at: string | null;
  is_visible: boolean;
  is_investable: boolean;
  amc_kill_switch: boolean;
};

export type MfFundAdminDetail = MfFundAdmin & {
  returns: {
    return_1d: number | null;
    return_1w: number | null;
    return_1m: number | null;
    return_3m: number | null;
    return_6m: number | null;
    return_1y: number | null;
    return_3y: number | null;
    return_5y: number | null;
  };
  metrics_as_of: string | null;
};

export type MfFundNavHistory = {
  fund_id: number;
  from_date: string;
  to_date: string;
  count: number;
  points: Array<{ date: string; nav: number | null }>;
};

export type MfAmc = {
  id: number;
  name: string;
  slug: string;
  amc_code: string | null;
  fp_amc_id: string | null;
  is_active: boolean;
  admin_kill_switch: boolean;
  logo_url: string | null;
};

export type MfJob = {
  name: string;
  sequence: number;
  phase: number;
  cron: string;
  enabled: boolean;
  description: string;
  depends_on: string[];
  last_run: {
    run_uuid: string | null;
    status: string | null;
    triggered_by: string | null;
    started_at: string | null;
    finished_at: string | null;
    records_processed: number | null;
    records_inserted: number | null;
    records_skipped: number | null;
    error_message: string | null;
    metadata: Record<string, unknown> | null;
  } | null;
};

export type MfIngestionRun = {
  job_name: string | null;
  run_uuid: string | null;
  status: string | null;
  triggered_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  records_processed: number | null;
  records_inserted: number | null;
  records_skipped: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

export async function fetchMfOverview() {
  return apiRequest<MfCatalogOverview>("/admin/mf/overview");
}

export type MfCatalogHealthSummary = {
  generated_at: string;
  config: {
    gates_enabled: boolean;
    nav_stale_days: number;
    min_nav_rows: number;
  };
  summary: Record<string, number>;
  checks: Array<{ key: string; severity: string; label: string; count: number }>;
  amc_zero_active: Array<{ amc_id: number; amc_name: string; amc_slug: string }>;
};

export type MfCatalogHealthIssue = {
  check: string | null;
  fund_id: number | null;
  product_id: string | null;
  scheme_name: string | null;
  amc_id: number | null;
  amc_name: string | null;
  health_flags: string[];
  latest_nav_date: string | null;
  nav_row_count: number | null;
  public_blocked?: boolean;
};

export async function fetchMfCatalogHealth() {
  return apiRequest<MfCatalogHealthSummary>("/admin/mf/catalog/health");
}

export async function fetchMfCatalogHealthIssues(check?: string, page = 1, pageSize = 10) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (check) params.set("check", check);
  return apiRequest<{
    items: MfCatalogHealthIssue[];
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
  }>(`/admin/mf/catalog/health/issues?${params.toString()}`);
}

export async function fetchMfCategories() {
  const result = await apiRequest<{ categories: MfCategoryAdmin[] }>("/admin/mf/categories");
  return result.categories;
}

export async function fetchMfCategoryFunds(categorySlug: string) {
  return apiRequest<MfCategoryFundsCuration>(`/admin/mf/categories/${encodeURIComponent(categorySlug)}/funds`);
}

export async function updateMfCategory(
  categoryId: number,
  payload: {
    name?: string;
    is_visible?: boolean;
    display_order?: number;
    min_funds_to_show?: number;
  }
) {
  return apiRequest<MfCategoryAdmin>(`/admin/mf/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function setMfCategoryFundOrder(
  categorySlug: string,
  items: Array<{
    product_id: string;
    display_order?: number | null;
    is_featured?: boolean;
    featured_rank?: number | null;
  }>
) {
  return apiRequest<MfCategoryFundsCuration>(
    `/admin/mf/categories/${encodeURIComponent(categorySlug)}/order`,
    {
      method: "PUT",
      body: JSON.stringify({ items }),
    }
  );
}

export async function addMfCategoryFund(
  categorySlug: string,
  payload: {
    product_id: string;
    display_order?: number;
    is_featured?: boolean;
    featured_rank?: number;
  }
) {
  return apiRequest<MfCategoryFundsCuration>(
    `/admin/mf/categories/${encodeURIComponent(categorySlug)}/funds`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function removeMfCategoryFund(categorySlug: string, productId: string) {
  return apiRequest<MfCategoryFundsCuration>(
    `/admin/mf/categories/${encodeURIComponent(categorySlug)}/funds/${encodeURIComponent(productId)}`,
    { method: "DELETE" }
  );
}

export async function bulkAddAmcToCategory(categorySlug: string, amcId: number) {
  return apiRequest<{ added: number; category: MfCategoryFundsCuration }>(
    `/admin/mf/categories/${encodeURIComponent(categorySlug)}/funds/bulk-amc`,
    {
      method: "POST",
      body: JSON.stringify({ amc_id: amcId }),
    }
  );
}

export type MfFundListParams = {
  page?: number;
  page_size?: number;
  q?: string;
  amc_id?: number;
  category_slug?: string;
  lifecycle_status?: string;
  fund_active?: boolean;
  amc_empanelled?: boolean;
  purchasable?: boolean;
};

export async function fetchMfFunds(params: MfFundListParams = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.q) search.set("q", params.q);
  if (params.amc_id != null) search.set("amc_id", String(params.amc_id));
  if (params.category_slug) search.set("category_slug", params.category_slug);
  if (params.lifecycle_status) search.set("lifecycle_status", params.lifecycle_status);
  if (params.fund_active != null) search.set("fund_active", String(params.fund_active));
  if (params.amc_empanelled != null) search.set("amc_empanelled", String(params.amc_empanelled));
  if (params.purchasable != null) search.set("purchasable", String(params.purchasable));
  const query = search.toString();
  return apiRequest<{
    items: MfFundAdmin[];
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
  }>(`/admin/mf/funds${query ? `?${query}` : ""}`);
}

export async function fetchMfFundDetail(fundId: number) {
  return apiRequest<MfFundAdminDetail>(`/admin/mf/funds/${fundId}`);
}

export async function fetchMfFundNavs(fundId: number, limit = 90) {
  return apiRequest<MfFundNavHistory>(`/admin/mf/funds/${fundId}/navs?limit=${limit}`);
}

export async function updateMfFund(
  fundId: number,
  payload: {
    is_active?: boolean;
    admin_visibility?: "AUTO" | "FORCE_SHOW" | "FORCE_HIDE";
    admin_investability?: "AUTO" | "BLOCK_ORDERS";
    reason?: string;
  }
) {
  return apiRequest<MfFundAdminDetail>(`/admin/mf/funds/${fundId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchMfAmcs() {
  const result = await apiRequest<{ amcs: MfAmc[] }>("/admin/mf/amcs");
  return result.amcs;
}

export async function updateMfAmc(
  amcId: number,
  payload: { is_active?: boolean; amc_code?: string; admin_kill_switch?: boolean; reason?: string }
) {
  return apiRequest<MfAmc>(`/admin/mf/amcs/${amcId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchMfJobs() {
  const result = await apiRequest<{ jobs: MfJob[] }>("/admin/mf/jobs");
  return result.jobs;
}

export type MfRunJobResult = {
  job: string;
  result: Record<string, unknown>;
};

export async function runMfJob(jobName: string, force = false) {
  const query = force ? "?force=true" : "";
  return apiRequest<MfRunJobResult>(
    `/admin/mf/jobs/${encodeURIComponent(jobName)}/run${query}`,
    { method: "POST" }
  );
}

export async function fetchMfIngestionRuns(limit = 20) {
  const result = await apiRequest<{ runs: MfIngestionRun[] }>(
    `/admin/mf/ingestion-runs?limit=${limit}`
  );
  return result.runs;
}

export type MfPipelineStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  result: Record<string, unknown> | null;
  error: string | null;
  ingestion_run_uuid: string | null;
};

export type MfPipelineLogLine = {
  timestamp: string;
  level: string;
  message: string;
};

export type MfPipelineMode =
  | "full"
  | "bootstrap"
  | "after-ingest"
  | "nav-analytics-only"
  | "health-repair"
  | "staging-only";

export type MfPipelineRun = {
  run_id: string;
  mode: string;
  triggered_by: string;
  status: "pending" | "running" | "paused" | "succeeded" | "failed" | "cancelled";
  started_at: string | null;
  finished_at: string | null;
  current_step_key: string | null;
  progress: {
    completed_steps: number;
    total_steps: number;
    percent: number;
  };
  steps: MfPipelineStep[];
  logs: MfPipelineLogLine[];
  final_counts: Record<string, unknown> | null;
  health_summary: Record<string, unknown> | null;
  error: string | null;
  can_resume: boolean;
  pause_reason: string | null;
  staging_batch_uuid: string | null;
  can_approve_staging: boolean;
  health_diff: MfPipelineHealthDiff | null;
  skip_steps: string[];
  auto_resume: boolean;
  auto_resume_pending: boolean;
};

export type MfPipelineMaintenanceWindow = {
  enabled: boolean;
  enforced: boolean;
  start: string;
  end: string;
  within_window: boolean;
  opens_at_ist: string | null;
};

export type MfPipelinePreview = {
  mode: string;
  dry_run: boolean;
  step_count: number;
  included_step_count: number;
  steps: Array<{ key: string; label: string }>;
  effective_steps: Array<{ key: string; label: string; included: boolean }>;
  scheduler_mapped_steps: Array<{ key: string; label: string; scheduler_job: string }>;
  skip_steps: string[];
  flags: {
    app_env: string;
    scheme_staging_enabled: boolean;
    scheme_promote_auto: boolean;
    requires_production_confirm: boolean;
    maintenance_window: MfPipelineMaintenanceWindow;
    auto_resume_enabled: boolean;
  };
  blockers: string[];
  can_start: boolean;
};

export type MfPipelineHealthDiff = {
  before_totals: { critical: number; warning: number; public_blocked: number };
  after_totals: { critical: number; warning: number; public_blocked: number };
  totals_delta: Partial<Record<"critical" | "warning" | "public_blocked", number>>;
  changes: Array<{
    key: string;
    label: string;
    severity: string | null;
    before: number;
    after: number;
    delta: number;
  }>;
};

export async function previewMfPipeline(mode: MfPipelineMode = "full", skipSteps: string[] = []) {
  const skipQuery =
    skipSteps.length > 0 ? `&skip_steps=${encodeURIComponent(skipSteps.join(","))}` : "";
  return apiRequest<MfPipelinePreview>(
    `/admin/mf/pipeline/preview?mode=${encodeURIComponent(mode)}${skipQuery}`
  );
}

export async function startMfPipeline(
  mode: MfPipelineMode = "full",
  confirmProduction = false,
  skipSteps: string[] = [],
  autoResume = true
) {
  const result = await apiRequest<{ run: MfPipelineRun }>("/admin/mf/pipeline/run", {
    method: "POST",
    body: JSON.stringify({
      mode,
      confirm_production: confirmProduction,
      skip_steps: skipSteps,
      auto_resume: autoResume,
    }),
  });
  return result.run;
}

export async function fetchMfPipelineRun(runId: string) {
  const result = await apiRequest<{ run: MfPipelineRun }>(
    `/admin/mf/pipeline/runs/${encodeURIComponent(runId)}`
  );
  return result.run;
}

export async function fetchActiveMfPipelineRun() {
  const result = await apiRequest<{ run: MfPipelineRun }>("/admin/mf/pipeline/runs/active");
  return result.run;
}

export async function cancelMfPipelineRun(runId: string) {
  const result = await apiRequest<{ run: MfPipelineRun }>(
    `/admin/mf/pipeline/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST" }
  );
  return result.run;
}

export async function resumeMfPipelineRun(runId: string) {
  const result = await apiRequest<{ run: MfPipelineRun }>(
    `/admin/mf/pipeline/runs/${encodeURIComponent(runId)}/resume`,
    { method: "POST" }
  );
  return result.run;
}

export async function retryMfPipelineStep(runId: string, stepKey: string) {
  const result = await apiRequest<{ run: MfPipelineRun }>(
    `/admin/mf/pipeline/runs/${encodeURIComponent(runId)}/retry-step`,
    { method: "POST", body: JSON.stringify({ step_key: stepKey }) }
  );
  return result.run;
}

export async function clearStuckMfPipelineRuns() {
  return apiRequest<{ cleaned: number }>("/admin/mf/pipeline/clear-stuck", { method: "POST" });
}

export async function approveMfPipelineStaging(runId: string) {
  const result = await apiRequest<{ run: MfPipelineRun }>(
    `/admin/mf/pipeline/runs/${encodeURIComponent(runId)}/approve-staging`,
    { method: "POST" }
  );
  return result.run;
}

export type MfProductContent = {
  tagline: string | null;
  hero_badge: string | null;
  risk_label: string | null;
  benchmark_name: string | null;
  fund_manager_name: string | null;
  disclaimer_text: string | null;
  seo_slug: string | null;
  seo_meta_description: string | null;
  updated_at: string | null;
};

export type MfFundContent = {
  fund_id: number;
  product_id: string | null;
  content: MfProductContent;
};

export type MfAmcContent = {
  amc_id: number;
  amc_name: string;
  content: {
    marketing_name: string | null;
    description: string | null;
    website_url: string | null;
    updated_at: string | null;
  };
};

export type MfComplianceSettings = {
  default_disclaimer: string;
  distributor_arn: string | null;
  distributor_euin: string | null;
  updated_at: string | null;
  source: {
    default_disclaimer: string;
    distributor_arn: string;
    distributor_euin: string;
  };
};

export function fetchMfFundContent(fundId: number) {
  return apiRequest<MfFundContent>(`/admin/mf/funds/${fundId}/content`);
}

export function updateMfFundContent(fundId: number, body: Partial<MfProductContent>) {
  return apiRequest<MfFundContent>(`/admin/mf/funds/${fundId}/content`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function fetchMfAmcContent(amcId: number) {
  return apiRequest<MfAmcContent>(`/admin/mf/amcs/${amcId}/content`);
}

export function updateMfAmcContent(
  amcId: number,
  body: { marketing_name?: string; description?: string; website_url?: string },
) {
  return apiRequest<MfAmcContent>(`/admin/mf/amcs/${amcId}/content`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function fetchMfComplianceSettings() {
  return apiRequest<MfComplianceSettings>("/admin/mf/compliance");
}

export function updateMfComplianceSettings(body: {
  default_disclaimer?: string;
  distributor_arn?: string;
  distributor_euin?: string;
  clear_default_disclaimer?: boolean;
  clear_distributor_arn?: boolean;
  clear_distributor_euin?: boolean;
}) {
  return apiRequest<MfComplianceSettings>("/admin/mf/compliance", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type MfCatalogRule = {
  id: number;
  name: string;
  description: string | null;
  priority: number;
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export function fetchMfCatalogRules() {
  return apiRequest<{ rules: MfCatalogRule[] }>("/admin/mf/rules").then((r) => r.rules);
}

export function createMfCatalogRule(body: {
  name: string;
  description?: string;
  priority?: number;
  enabled?: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
}) {
  return apiRequest<MfCatalogRule>("/admin/mf/rules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateMfCatalogRule(ruleId: number, body: Partial<Omit<MfCatalogRule, "id">>) {
  return apiRequest<MfCatalogRule>(`/admin/mf/rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function previewMfCatalogRules(ruleIds?: number[]) {
  return apiRequest<{ affected_count: number; items: Array<Record<string, unknown>>; rules: MfCatalogRule[] }>(
    "/admin/mf/rules/preview",
    { method: "POST", body: JSON.stringify({ rule_ids: ruleIds }) },
  );
}

export function applyMfCatalogRules(body: { rule_ids?: number[]; dry_run?: boolean; reason?: string }) {
  return apiRequest<{
    affected_count: number;
    items: Array<Record<string, unknown>>;
    rules: MfCatalogRule[];
    run_id?: number | null;
    pending_action_id?: string | null;
  }>("/admin/mf/rules/apply", { method: "POST", body: JSON.stringify(body) });
}

export function previewMfBulkCatalog(csv: string) {
  return apiRequest<Record<string, unknown>>("/admin/mf/funds/bulk/preview", {
    method: "POST",
    body: JSON.stringify({ csv }),
  });
}

export type MfBulkCatalogJob = {
  job_id: string;
  status: string;
  dry_run?: boolean;
  row_count?: number;
  affected_count?: number;
  result?: Record<string, unknown>;
  failure_reason?: string | null;
  admin_action_id?: string | null;
  requires_maker_checker?: boolean;
  preview?: Record<string, unknown>;
  created_at?: string | null;
  completed_at?: string | null;
};

export function submitMfBulkCatalog(body: { csv: string; dry_run?: boolean; reason?: string }) {
  return apiRequest<MfBulkCatalogJob>("/admin/mf/funds/bulk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchMfBulkCatalogJobs(limit = 20) {
  return apiRequest<{ jobs: MfBulkCatalogJob[] }>(`/admin/mf/funds/bulk/jobs?limit=${limit}`).then(
    (r) => r.jobs,
  );
}

export type MfStagingBatch = {
  batch_uuid: string;
  source?: string | null;
  status: string;
  triggered_by?: string | null;
  stats: {
    pages?: number;
    raw_rows?: number;
    normalized?: number;
    excluded?: number;
    invalid?: number;
    promoted?: number;
    updated?: number;
    inserted?: number;
    skipped?: number;
  };
  validation_errors?: string[];
  rejection_reason?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  finished_at?: string | null;
};

export type MfStagingRow = {
  mongo_id?: string | null;
  isin_growth?: string | null;
  scheme_name?: string | null;
  amc_name?: string | null;
  validation_status?: string | null;
  validation_reason?: string | null;
  validation_flags?: string[];
  promote_status?: string | null;
  product_id?: string | null;
  fund_id?: number | null;
  amc_id?: number | null;
  promote_error?: string | null;
};

export function fetchMfStagingBatches(limit = 20, status?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return apiRequest<{ batches: MfStagingBatch[] }>(`/admin/mf/staging/batches?${params}`).then(
    (r) => r.batches,
  );
}

export function fetchMfStagingBatchRows(
  batchUuid: string,
  params?: {
    validation_status?: string;
    promote_status?: string;
    page?: number;
    page_size?: number;
  },
) {
  const search = new URLSearchParams();
  if (params?.validation_status) search.set("validation_status", params.validation_status);
  if (params?.promote_status) search.set("promote_status", params.promote_status);
  if (params?.page) search.set("page", String(params.page));
  if (params?.page_size) search.set("page_size", String(params.page_size));
  const query = search.toString();
  return apiRequest<{
    items: MfStagingRow[];
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
  }>(`/admin/mf/staging/batches/${encodeURIComponent(batchUuid)}/rows${query ? `?${query}` : ""}`);
}

export function approveMfStagingBatch(batchUuid: string) {
  return apiRequest<MfStagingBatch>(`/admin/mf/staging/batches/${encodeURIComponent(batchUuid)}/approve`, {
    method: "POST",
  });
}

export function rejectMfStagingBatch(batchUuid: string, reason: string) {
  return apiRequest<MfStagingBatch>(`/admin/mf/staging/batches/${encodeURIComponent(batchUuid)}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function promoteMfStagingBatch(batchUuid: string) {
  return apiRequest<MfRunJobResult>(`/admin/mf/staging/batches/${encodeURIComponent(batchUuid)}/promote`, {
    method: "POST",
  });
}
