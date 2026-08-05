import { apiRequest } from "@/lib/api-client";

export type RiskCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  weight: number;
  sort_order: number;
  is_active: boolean;
  question_count?: number;
};

export type RiskQuestionOption = {
  id: string;
  label: string;
  score_value: number;
  sort_order: number;
};

export type RiskQuestion = {
  id: string;
  category_id: string;
  category_slug: string | null;
  category_name: string | null;
  prompt: string;
  help_text: string | null;
  sort_order: number;
  is_active: boolean;
  options: RiskQuestionOption[];
};

export type RiskTier = {
  tier: string;
  min_score: number;
  max_score: number;
  title: string;
  message_body: string;
  sort_order: number;
};

export type RiskTemplateRule = {
  category_id: string;
  category_slug: string | null;
  category_name: string | null;
  question_count: number;
  sort_order: number;
};

export type RiskTemplate = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  selection_mode: "manual" | "auto";
  sort_order: number;
  total_questions: number;
  rules: RiskTemplateRule[];
};

export type RiskBulkPreview = {
  row_count: number;
  valid_count: number;
  error_count: number;
  ready: boolean;
  rows: Array<{
    line: string;
    category_slug: string;
    prompt: string;
    help_text: string | null;
    sort_order: number;
    category_exists: boolean;
    status: string;
    options: Array<{ label: string; score_value: number; sort_order: number }>;
  }>;
  errors: Array<{ line: string; code: string; message: string }>;
};

export type UserRiskProfileItem = {
  user_id: string;
  client_id: string;
  email: string;
  display_name: string;
  profile_image_url: string | null;
  assessment_count: number;
  score: number;
  tier: string;
  assessment_id: string;
  computed_at: string | null;
  updated_at: string | null;
};

export type UserRiskProfileAssessmentItem = {
  assessment_id: string;
  score: number;
  display_score: number;
  tier: string;
  tier_config: RiskTier;
  completed_at: string | null;
  questions_answered: number;
  total_questions: number;
};

export type UserRiskProfileAssessmentDetail = {
  user_id: string;
  assessment_id: string;
  score: number;
  display_score: number;
  tier: string;
  tier_config: RiskTier;
  completed_at: string | null;
  questions_answered: number;
  total_questions: number;
  answers: Array<{
    question_id: string;
    category_name: string | null;
    prompt: string;
    help_text: string | null;
    sort_order: number;
    selected_option_id: string;
    selected_option_label: string;
    options: Array<{ id: string; label: string; selected: boolean; score_value?: number | null; sort_order?: number }>;
  }>;
  scoring: {
    final_score: number;
    formula_summary: string;
    categories: Array<{
      category_id: string;
      category_name: string;
      weight: number;
      normalized_score: number;
      weight_share: number;
      weighted_contribution: number;
      questions_answered: number;
    }>;
  };
};

export async function fetchUserRiskProfileAssessments(userId: string) {
  return apiRequest<{ items: UserRiskProfileAssessmentItem[]; limit: number; offset: number }>(
    `/admin/risk-profile/users/${userId}/assessments`,
  );
}

export async function fetchUserRiskProfileAssessmentDetail(userId: string, assessmentId: string) {
  return apiRequest<UserRiskProfileAssessmentDetail>(
    `/admin/risk-profile/users/${userId}/assessments/${assessmentId}`,
  );
}

export async function fetchRiskCategories(includeInactive = false) {
  const response = await apiRequest<{ categories: RiskCategory[] }>(
    `/admin/risk-profile/categories?include_inactive=${includeInactive}`,
  );
  return response.categories;
}

export async function createRiskCategory(body: {
  name: string;
  description?: string;
  weight: number;
  sort_order?: number;
}) {
  return apiRequest<RiskCategory>("/admin/risk-profile/categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRiskCategory(
  categoryId: string,
  body: Partial<{
    name: string;
    description: string | null;
    weight: number;
    sort_order: number;
    is_active: boolean;
  }>,
) {
  return apiRequest<RiskCategory>(`/admin/risk-profile/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchRiskQuestions(params?: { categoryId?: string; includeInactive?: boolean }) {
  const search = new URLSearchParams();
  if (params?.categoryId) search.set("category_id", params.categoryId);
  if (params?.includeInactive) search.set("include_inactive", "true");
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiRequest<{ questions: RiskQuestion[] }>(`/admin/risk-profile/questions${suffix}`);
  return response.questions;
}

export async function createRiskQuestion(body: {
  category_id: string;
  prompt: string;
  help_text?: string;
  options: Array<{ label: string; score_value: number; sort_order: number }>;
}) {
  return apiRequest<RiskQuestion>("/admin/risk-profile/questions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRiskQuestion(
  questionId: string,
  body: Partial<{
    category_id: string;
    prompt: string;
    help_text: string | null;
    is_active: boolean;
    options: Array<{ label: string; score_value: number; sort_order: number }>;
  }>,
) {
  return apiRequest<RiskQuestion>(`/admin/risk-profile/questions/${questionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteRiskQuestion(questionId: string) {
  return apiRequest<RiskQuestion>(`/admin/risk-profile/questions/${questionId}`, {
    method: "DELETE",
  });
}

export async function previewRiskBulkImport(body: {
  csv: string;
  create_missing_categories?: boolean;
  default_category_weight?: number;
}) {
  return apiRequest<RiskBulkPreview>("/admin/risk-profile/questions/bulk/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function submitRiskBulkImport(body: {
  csv: string;
  create_missing_categories?: boolean;
  default_category_weight?: number;
}) {
  return apiRequest<{
    row_count: number;
    created_categories: number;
    created_questions: number;
    question_ids: string[];
  }>("/admin/risk-profile/questions/bulk/submit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchRiskTemplates(includeInactive = false) {
  const response = await apiRequest<{ templates: RiskTemplate[] }>(
    `/admin/risk-profile/templates?include_inactive=${includeInactive}`,
  );
  return response.templates;
}

export async function createRiskTemplate(body: {
  name: string;
  description?: string;
  is_default?: boolean;
  selection_mode?: "manual" | "auto";
  sort_order?: number;
  rules: Array<{ category_id: string; question_count: number; sort_order?: number }>;
}) {
  return apiRequest<RiskTemplate>("/admin/risk-profile/templates", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRiskTemplate(
  templateId: string,
  body: Partial<{
    name: string;
    description: string | null;
    is_default: boolean;
    is_active: boolean;
    selection_mode: "manual" | "auto";
    sort_order: number;
    rules: Array<{ category_id: string; question_count: number; sort_order?: number }>;
  }>,
) {
  return apiRequest<RiskTemplate>(`/admin/risk-profile/templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchRiskTemplateQuestions(templateId: string) {
  return apiRequest<{ template: RiskTemplate; questions: RiskQuestion[]; total_questions: number }>(
    `/admin/risk-profile/templates/${templateId}/questions`,
  );
}

export async function autoSelectRiskTemplate(body?: {
  user_id?: string;
  target_question_count?: number;
}) {
  return apiRequest<{
    selection_reason: string;
    preferred_question_count: number;
    template: RiskTemplate;
    questions: RiskQuestion[];
    total_questions: number;
  }>("/admin/risk-profile/templates/auto-select", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function fetchRiskTiers() {
  const response = await apiRequest<{ tiers: RiskTier[] }>("/admin/risk-profile/tiers");
  return response.tiers;
}

export async function updateRiskTier(
  tier: string,
  body: Partial<{
    min_score: number;
    max_score: number;
    title: string;
    message_body: string;
    sort_order: number;
  }>,
) {
  return apiRequest<RiskTier>(`/admin/risk-profile/tiers/${tier}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export type UserRiskProfileDetail = UserRiskProfileItem & {
  tier_config: RiskTier;
};

export type RiskAuditLogItem = {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function fetchUserRiskProfile(userId: string) {
  return apiRequest<UserRiskProfileDetail>(`/admin/risk-profile/users/${userId}`);
}

export async function fetchRiskAuditLogs(params?: {
  user_id?: string;
  event_type?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.user_id) search.set("user_id", params.user_id);
  if (params?.event_type) search.set("event_type", params.event_type);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiRequest<{ items: RiskAuditLogItem[]; limit: number; offset: number }>(
    `/admin/risk-profile/audit${suffix}`,
  );
}

export async function fetchUserRiskProfiles(params?: { tier?: string; limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  if (params?.tier) search.set("tier", params.tier);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiRequest<{ items: UserRiskProfileItem[]; limit: number; offset: number }>(
    `/admin/risk-profile/users${suffix}`,
  );
}

export type LockedRiskProfileUser = {
  user_id: string;
  client_id: string;
  email: string;
  display_name: string;
  profile_image_url: string | null;
  completed_count: number;
  granted_attempts: number;
  attempts_remaining: number;
  is_locked: boolean;
  locked_at: string | null;
  updated_at: string | null;
};

export type RiskProfileUnlockJourneyStep = {
  id: string;
  kind: "locked" | "otp_requested" | "otp_failed" | "otp_expired" | "granted";
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  admin_id: string | null;
  admin_email: string | null;
  admin_display_name: string | null;
  attempts_granted: number | null;
  metadata: Record<string, unknown>;
};

export type RiskProfileUnlockJourney = {
  user_id: string;
  attempt_state: {
    completed_count: number;
    granted_attempts: number;
    attempts_remaining: number;
    is_locked: boolean;
    locked_at: string | null;
  };
  steps: RiskProfileUnlockJourneyStep[];
};

export async function fetchRiskProfileUnlockJourney(userId: string) {
  return apiRequest<RiskProfileUnlockJourney>(`/admin/risk-profile/users/${userId}/unlock-journey`);
}

export async function fetchLockedRiskProfiles(params?: { limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiRequest<{ items: LockedRiskProfileUser[]; limit: number; offset: number }>(
    `/admin/risk-profile/locked-users${suffix}`,
  );
}

export async function requestRiskProfileUnlock(userId: string) {
  return apiRequest<{ expires_in: number }>(`/admin/risk-profile/users/${userId}/unlock/request`, {
    method: "POST",
  });
}

export async function confirmRiskProfileUnlock(userId: string, body: { otp_code: string }) {
  return apiRequest<{
    completed_count: number;
    granted_attempts: number;
    attempts_remaining: number;
    is_locked: boolean;
    locked_at: string | null;
    updated_at: string | null;
  }>(`/admin/risk-profile/users/${userId}/unlock/confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export const RISK_BULK_SAMPLE_CSV = `category_slug,question_prompt,option_1,option_1_score,option_2,option_2_score,option_3,option_3_score,option_4,option_4_score,help_text,sort_order
time_horizon,How long can you stay invested?,Less than 1 year,10,1-3 years,40,3-5 years,70,5+ years,90,,1
loss_tolerance,How would you react to a 20% portfolio drop?,Sell immediately,10,Reduce exposure,35,Hold steady,70,Invest more,90,,1`;
