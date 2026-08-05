import type { RiskProfileAssessmentHistoryItem } from "@/features/risk-profile/api/risk-profile-api";
import {
  resolveDisplayScore,
  resolveTierMessageParts,
  type RiskProfileHistoryRow,
} from "@/features/risk-profile/lib/risk-tier-ui";

export function mapAssessmentHistoryItemToRow(
  item: RiskProfileAssessmentHistoryItem,
): RiskProfileHistoryRow | null {
  if (!item.completed_at) return null;

  const { summary, recommendation } = resolveTierMessageParts(item.tier_config);

  return {
    id: item.assessment_id,
    date: item.completed_at,
    tier: item.tier as RiskProfileHistoryRow["tier"],
    score: item.score,
    displayScore: resolveDisplayScore(item.score, item.display_score),
    questionsAnswered: item.questions_answered,
    totalQuestions: item.total_questions,
    message: item.tier_config.message_body,
    messageSummary: summary,
    messageRecommendation: recommendation,
  };
}

export function mapAssessmentHistoryToRows(
  items: RiskProfileAssessmentHistoryItem[],
): RiskProfileHistoryRow[] {
  return items
    .map(mapAssessmentHistoryItemToRow)
    .filter((row): row is RiskProfileHistoryRow => row !== null);
}

export function mapAssessmentHistoryToTrendPoints(items: RiskProfileAssessmentHistoryItem[]) {
  return [...items]
    .filter((item) => item.completed_at)
    .sort(
      (left, right) =>
        new Date(left.completed_at!).getTime() - new Date(right.completed_at!).getTime(),
    )
    .map((item) => ({
      label: new Date(item.completed_at!).toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
      }),
      score: resolveDisplayScore(item.score, item.display_score),
    }));
}
