import { ApiError, apiRequest, getAccessToken } from "@/lib/api-client";
import { env } from "@/lib/env";
import type {
  DistributorClientRiskAssessment,
  DistributorClientRiskAssessmentAnswer,
} from "@/lib/distributor-types";

type ApiTierConfig = {
  message_summary?: string;
  message_recommendation?: string;
  title?: string;
};

type ApiAssessmentItem = {
  assessment_id: string;
  score: number;
  display_score: number;
  tier: string;
  tier_config?: ApiTierConfig;
  completed_at: string | null;
  questions_answered: number;
  total_questions: number;
};

type ApiAssessmentDetail = ApiAssessmentItem & {
  answers: Array<{
    question_id: string;
    category_name?: string | null;
    prompt: string;
    help_text?: string | null;
    sort_order: number;
    selected_option_label: string;
  }>;
};

function mapAssessmentItem(row: ApiAssessmentItem, index: number): DistributorClientRiskAssessment {
  return {
    assessmentId: row.assessment_id,
    score: row.score,
    displayScore: row.display_score,
    tier: row.tier,
    completedAt: row.completed_at,
    questionsAnswered: row.questions_answered,
    totalQuestions: row.total_questions,
    messageSummary: row.tier_config?.message_summary ?? row.tier_config?.title,
    messageRecommendation: row.tier_config?.message_recommendation,
    isCurrent: index === 0,
  };
}

function mapAnswers(rows: ApiAssessmentDetail["answers"]): DistributorClientRiskAssessmentAnswer[] {
  return rows.map((row) => ({
    questionId: row.question_id,
    categoryName: row.category_name,
    prompt: row.prompt,
    helpText: row.help_text,
    sortOrder: row.sort_order,
    selectedOptionLabel: row.selected_option_label,
  }));
}

export async function fetchDistributorClientRiskAssessments(
  clientReference: string,
): Promise<DistributorClientRiskAssessment[]> {
  const response = await apiRequest<{ items: ApiAssessmentItem[] }>(
    `/distributor/clients/${encodeURIComponent(clientReference)}/risk-profile/assessments`,
  );
  return (response.items ?? []).map(mapAssessmentItem);
}

export async function fetchDistributorClientRiskAssessmentDetail(
  clientReference: string,
  assessmentId: string,
): Promise<{
  assessment: DistributorClientRiskAssessment;
  answers: DistributorClientRiskAssessmentAnswer[];
}> {
  const response = await apiRequest<ApiAssessmentDetail>(
    `/distributor/clients/${encodeURIComponent(clientReference)}/risk-profile/assessments/${encodeURIComponent(assessmentId)}`,
  );
  return {
    assessment: mapAssessmentItem(response, 0),
    answers: mapAnswers(response.answers ?? []),
  };
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const basicMatch = header.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] ?? null;
}

export async function downloadDistributorClientRiskReport(
  clientReference: string,
  assessmentId: string,
): Promise<void> {
  const response = await fetch(
    `${env.apiUrl}/distributor/clients/${encodeURIComponent(clientReference)}/risk-profile/assessments/${encodeURIComponent(assessmentId)}/report/download`,
    {
      credentials: "include",
      headers: {
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      },
    },
  );

  if (!response.ok) {
    throw new ApiError("Could not download report.", "download_failed", response.status);
  }

  const filename =
    parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
    "zynd-risk-profile-report.pdf";
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
