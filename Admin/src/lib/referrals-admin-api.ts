import { pickUserRef, userRefToPath } from "@/lib/admin-user-ref";
import { apiRequest } from "@/lib/api-client";

export type AdminReferralUserSummary = {
  user_id: string;
  client_id: string;
  email: string;
  display_name: string;
};

export type AdminReferralAttribution = {
  id: string;
  referral_code: string;
  current_stage:
    | "signed_up"
    | "kyc_verified"
    | "first_investment"
    | "qualified"
    | "engaged";
  signup_channel: "email" | "google" | "apple";
  signed_up_at: string;
  kyc_verified_at: string | null;
  first_investment_at: string | null;
  first_investment_product: "mutual_fund" | "fixed_deposit" | "other" | null;
  first_investment_amount_inr: number | null;
  first_investment_reversed_at: string | null;
  qualified_at: string | null;
  engaged_at: string | null;
  estimated_reward_inr: number;
  pending_qualification: boolean;
  qualification_due_at: string | null;
  referrer: AdminReferralUserSummary | null;
  referee: AdminReferralUserSummary | null;
};

export type AdminReferralMetrics = {
  total_clicks: number;
  total_attributions: number;
  total_referrers: number;
  stage_counts: Record<string, number>;
  kyc_verified_count: number;
  first_investment_count: number;
  qualified_count: number;
  engaged_count: number;
  estimated_earnings_inr: number;
  conversion_click_to_signup_pct: number;
  conversion_signup_to_invest_pct: number;
};

export type AdminReferralScheme = {
  reward_rate_pct: number;
  min_first_investment_inr: number;
  qualification_hold_days: number;
  min_engagement_investment_inr: number;
  aum_milestone_inr: number;
  stages: string[];
  reward_note: string;
  rules?: AdminReferralRewardRule[];
};

export type AdminReferralRewardRule = {
  id: string;
  name: string;
  description: string | null;
  trigger: "first_investment" | "kyc_verified" | "qualified" | "engaged";
  reward_type: "flat_inr" | "percent";
  reward_value: number;
  min_investment_inr: number | null;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  sort_order: number;
};

export type AdminReferralReferrerDirectoryEntry = {
  referral_count: number;
  click_count: number;
  estimated_earnings_inr: number;
  paid_earnings_inr: number;
  referral_code: string | null;
  referral_code_active: boolean;
  display_name: string;
  user: AdminReferralUserSummary | null;
};

export type AdminReferralRewardLedgerEntry = {
  id: string;
  attribution_id: string;
  rule_id: string | null;
  rule_name: string;
  trigger: AdminReferralRewardRule["trigger"];
  amount_inr: number;
  status: "pending" | "approved" | "paid" | "reversed" | "cancelled";
  earned_at: string;
  paid_at: string | null;
  notes: string | null;
  referrer: AdminReferralUserSummary | null;
  referee: AdminReferralUserSummary | null;
};

export type AdminReferralLeaderboardEntry = {
  rank: number;
  referral_count: number;
  estimated_earnings_inr: number;
  referral_code: string | null;
  display_name: string;
  user: AdminReferralUserSummary | null;
};

export type AdminReferralLeaderboardMonth = {
  period_key: string;
  label: string;
  has_snapshot: boolean;
  is_current: boolean;
};

export type AdminReferralLeaderboardConfig = {
  primary_metric: "signup_count" | "kyc_verified_count" | "first_investment_count" | "qualified_count";
  tie_breaker_1: "earnings_inr_desc" | "referral_count_desc" | "earliest_referral_asc";
  tie_breaker_2: "earnings_inr_desc" | "referral_count_desc" | "earliest_referral_asc";
  period_field: "signed_up_at" | "first_investment_at" | "qualified_at";
  auto_snapshot_enabled: boolean;
  updated_at: string;
};

export type AdminReferralProgramSettings = {
  min_referrals_to_redeem: number;
  lumpsum_retention_days: number;
  default_qualification_hold_days: number;
  min_first_investment_inr: number;
  timezone: string;
  updated_at: string;
};

export type AdminUserReferrals = {
  user: AdminReferralUserSummary;
  referral_code: string | null;
  referral_code_active: boolean;
  share_url: string | null;
  click_count: number;
  counts: {
    signup_count: number;
    kyc_verified_count: number;
    first_investment_count: number;
    qualified_count: number;
    engaged_count: number;
  };
  total_estimated_earnings_inr: number;
  referrals: AdminReferralAttribution[];
  referred_by: AdminReferralAttribution | null;
};

function referralUserPath(userRef: string) {
  return encodeURIComponent(
    userRefToPath(pickUserRef({ client_id: userRef, user_id: userRef })),
  );
}

export async function fetchAdminReferralMetrics() {
  return apiRequest<AdminReferralMetrics>("/admin/referrals/metrics");
}

export async function fetchAdminReferralScheme() {
  return apiRequest<AdminReferralScheme>("/admin/referrals/scheme");
}

export async function fetchAdminReferralAttributions(params?: {
  stage?: string;
  search?: string;
  pending_only?: boolean;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.stage) query.set("stage", params.stage);
  if (params?.search) query.set("search", params.search);
  if (params?.pending_only) query.set("pending_only", "true");
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ items: AdminReferralAttribution[]; limit: number; offset: number }>(
    `/admin/referrals/attributions${suffix}`,
  );
}

export async function fetchAdminReferralLeaderboard(period = "all_time") {
  return apiRequest<{
    period: string;
    is_snapshot: boolean;
    is_final: boolean;
    items: AdminReferralLeaderboardEntry[];
  }>(`/admin/referrals/leaderboard?period=${encodeURIComponent(period)}`);
}

export async function fetchAdminReferralLeaderboardMonths(count = 12) {
  return apiRequest<{ items: AdminReferralLeaderboardMonth[] }>(
    `/admin/referrals/leaderboard/months?count=${count}`,
  );
}

export async function fetchAdminReferralLeaderboardConfig() {
  return apiRequest<AdminReferralLeaderboardConfig>("/admin/referrals/leaderboard/config");
}

export async function updateAdminReferralLeaderboardConfig(
  body: Partial<Omit<AdminReferralLeaderboardConfig, "updated_at">>,
) {
  return apiRequest<AdminReferralLeaderboardConfig>("/admin/referrals/leaderboard/config", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function snapshotAdminReferralLeaderboard(period: string, finalize = false) {
  return apiRequest<{ period_key: string; rows: number; finalized: number }>(
    `/admin/referrals/leaderboard/snapshot?period=${encodeURIComponent(period)}&finalize=${finalize ? "true" : "false"}`,
    { method: "POST" },
  );
}

export async function fetchAdminReferralProgramSettings() {
  return apiRequest<AdminReferralProgramSettings>("/admin/referrals/program-settings");
}

export async function updateAdminReferralProgramSettings(
  body: Partial<Omit<AdminReferralProgramSettings, "updated_at">>,
) {
  return apiRequest<AdminReferralProgramSettings>("/admin/referrals/program-settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchAdminUserReferrals(userRef: string) {
  return apiRequest<AdminUserReferrals>(`/admin/referrals/users/${referralUserPath(userRef)}`);
}

export async function fetchAdminReferralReferrers(params?: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ items: AdminReferralReferrerDirectoryEntry[]; limit: number; offset: number }>(
    `/admin/referrals/referrers${suffix}`,
  );
}

export async function fetchAdminReferralRewardRules() {
  return apiRequest<{ items: AdminReferralRewardRule[] }>("/admin/referrals/reward-rules");
}

export async function createAdminReferralRewardRule(body: {
  name: string;
  description?: string;
  trigger: AdminReferralRewardRule["trigger"];
  reward_type: AdminReferralRewardRule["reward_type"];
  reward_value: number;
  min_investment_inr?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  is_active?: boolean;
  sort_order?: number;
}) {
  return apiRequest<AdminReferralRewardRule>("/admin/referrals/reward-rules", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateAdminReferralRewardRule(
  ruleId: string,
  body: Partial<{
    name: string;
    description: string | null;
    trigger: AdminReferralRewardRule["trigger"];
    reward_type: AdminReferralRewardRule["reward_type"];
    reward_value: number;
    min_investment_inr: number | null;
    valid_from: string | null;
    valid_to: string | null;
    is_active: boolean;
    sort_order: number;
  }>,
) {
  return apiRequest<AdminReferralRewardRule>(`/admin/referrals/reward-rules/${encodeURIComponent(ruleId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchAdminReferralRedemptions(params?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<{ items: AdminReferralRewardLedgerEntry[]; limit: number; offset: number }>(
    `/admin/referrals/redemptions${suffix}`,
  );
}

export async function updateAdminReferralRedemptionStatus(
  entryId: string,
  body: { status: AdminReferralRewardLedgerEntry["status"]; notes?: string },
) {
  return apiRequest<AdminReferralRewardLedgerEntry>(
    `/admin/referrals/redemptions/${encodeURIComponent(entryId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function syncAdminReferralRedemptions(limit = 200) {
  return apiRequest<{ processed: number; created: number }>(
    `/admin/referrals/redemptions/sync?limit=${limit}`,
    { method: "POST" },
  );
}

export function formatReferralInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const REFERRAL_STAGE_LABELS: Record<AdminReferralAttribution["current_stage"], string> = {
  signed_up: "Signed up",
  kyc_verified: "KYC verified",
  first_investment: "First investment",
  qualified: "Qualified",
  engaged: "Engaged",
};

export function referralProgressStep(stage: AdminReferralAttribution["current_stage"]) {
  if (stage === "first_investment" || stage === "qualified" || stage === "engaged") return 3;
  if (stage === "kyc_verified") return 2;
  return 1;
}
