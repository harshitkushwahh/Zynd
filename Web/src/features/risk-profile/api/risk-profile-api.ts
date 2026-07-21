import { apiRequest } from "@/lib/api-client";

export type RiskProfileQuestionOption = {
  id: string;
  label: string;
  score_value: number;
  sort_order: number;
};

export type RiskProfileQuestion = {
  id: string;
  category_id: string;
  category_slug: string | null;
  category_name: string | null;
  prompt: string;
  help_text: string | null;
  sort_order: number;
  options: RiskProfileQuestionOption[];
};

export type RiskProfileTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  selection_mode: string;
  total_questions: number;
};

export type RiskProfileTierConfig = {
  tier: string;
  min_score: number;
  max_score: number;
  display_score: number;
  display_score_min: number;
  display_score_max: number;
  title: string;
  message_body: string;
  message_summary: string;
  message_recommendation: string;
  sort_order: number;
  updated_at: string | null;
};

export type RiskProfileConfig = {
  trends_min_profiles: number;
  default_attempts: number;
  unlock_bonus_attempts: number;
};

export type RiskProfileAssessment = {
  selection_reason: string | null;
  preferred_question_count: number | null;
  template: RiskProfileTemplateSummary | null;
  questions: RiskProfileQuestion[];
  total_questions: number;
};

export type RiskProfileAttemptState = {
  completed_count: number;
  granted_attempts: number;
  attempts_remaining: number;
  is_locked: boolean;
  locked_at: string | null;
  updated_at: string | null;
};

export type RiskProfileDraft = {
  template_id: string | null;
  question_ids: string[];
  answers: Record<string, string>;
  step_index: number;
  updated_at: string | null;
};

export type RiskProfileSession = {
  attempt_state: RiskProfileAttemptState;
  draft: RiskProfileDraft | null;
};

export type RiskProfileResult = {
  assessment_id: string;
  score: number;
  display_score: number;
  tier: string;
  tier_config: RiskProfileTierConfig;
  category_scores: Record<string, number>;
  attempt_state: RiskProfileAttemptState;
};

export type RiskProfileCurrent = {
  user_id: string;
  score: number;
  display_score: number;
  tier: string;
  tier_config: RiskProfileTierConfig;
  assessment_id: string;
  questions_answered: number;
  total_questions: number;
  computed_at: string | null;
  updated_at: string | null;
  attempt_state?: RiskProfileAttemptState | null;
};

export type RiskProfileAssessmentAnswerOption = {
  id: string;
  label: string;
  selected: boolean;
};

export type RiskProfileAssessmentAnswerItem = {
  question_id: string;
  category_name: string | null;
  prompt: string;
  help_text: string | null;
  sort_order: number;
  selected_option_id: string;
  selected_option_label: string;
  options?: RiskProfileAssessmentAnswerOption[];
};

export type RiskProfileAssessmentAnswers = {
  assessment_id: string;
  completed_at: string | null;
  answers: RiskProfileAssessmentAnswerItem[];
};

export type RiskProfileAssessmentHistoryItem = {
  assessment_id: string;
  score: number;
  display_score: number;
  tier: string;
  tier_config: RiskProfileTierConfig;
  completed_at: string | null;
  questions_answered: number;
  total_questions: number;
};

export function fetchRiskProfileAssessmentHistory(params?: { limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiRequest<{ items: RiskProfileAssessmentHistoryItem[]; limit: number; offset: number }>(
    `/invest/risk-profile/assessments${suffix}`,
  );
}

const ASSESSMENT_HISTORY_PAGE_SIZE = 100;

export async function fetchAllRiskProfileAssessmentHistory() {
  const items: RiskProfileAssessmentHistoryItem[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchRiskProfileAssessmentHistory({
      limit: ASSESSMENT_HISTORY_PAGE_SIZE,
      offset,
    });
    items.push(...page.items);
    if (page.items.length < ASSESSMENT_HISTORY_PAGE_SIZE) {
      break;
    }
    offset += ASSESSMENT_HISTORY_PAGE_SIZE;
  }

  return items;
}

export function fetchRiskProfileSession() {
  return apiRequest<RiskProfileSession>("/invest/risk-profile/session");
}

export function fetchRiskProfileAssessment() {
  return apiRequest<RiskProfileAssessment>("/invest/risk-profile/assessment");
}

export function saveRiskProfileDraft(body: {
  template_id?: string | null;
  question_ids: string[];
  answers: Record<string, string>;
  step_index: number;
}) {
  return apiRequest<RiskProfileDraft>("/invest/risk-profile/assessment/draft", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function discardRiskProfileDraft() {
  return apiRequest<void>("/invest/risk-profile/assessment/draft", {
    method: "DELETE",
  });
}

export function submitRiskProfileAssessment(body: {
  answers: Array<{ question_id: string; option_id: string }>;
  template_id?: string;
}) {
  return apiRequest<RiskProfileResult>("/invest/risk-profile/assessment/submit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchRiskProfileResult() {
  return apiRequest<RiskProfileCurrent>("/invest/risk-profile/result");
}

export function fetchRiskProfileTiers() {
  return apiRequest<{ items: RiskProfileTierConfig[] }>("/invest/risk-profile/tiers");
}

export function fetchRiskProfileConfig() {
  return apiRequest<RiskProfileConfig>("/invest/risk-profile/config");
}

export function fetchRiskProfileAssessmentAnswers(assessmentId: string) {
  return apiRequest<RiskProfileAssessmentAnswers>(
    `/invest/risk-profile/assessments/${assessmentId}/answers`,
  );
}

export type RiskProfileReportMetadata = {
  assessment_id: string;
  tier: string;
  score: number;
  cached: boolean;
  generated_at: string | null;
  filename: string;
};

export function fetchRiskProfileReport(assessmentId?: string) {
  const search = new URLSearchParams();
  if (assessmentId) {
    search.set("assessment_id", assessmentId);
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiRequest<RiskProfileReportMetadata>(`/invest/risk-profile/report${suffix}`);
}
