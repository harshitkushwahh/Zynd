import type { RiskProfileCurrent } from "@/features/risk-profile/api/risk-profile-api";
import {
  resolveDisplayScore,
  resolveTierMessageParts,
  type RiskProfileHistoryRow,
} from "@/features/risk-profile/lib/risk-tier-ui";

export function mapCurrentProfileToHistoryRow(
  profile: RiskProfileCurrent,
): RiskProfileHistoryRow | null {
  const date = profile.computed_at ?? profile.updated_at;
  if (!date) return null;

  const { summary, recommendation } = resolveTierMessageParts(profile.tier_config);

  return {
    id: profile.assessment_id,
    date,
    tier: profile.tier as RiskProfileHistoryRow["tier"],
    score: profile.score,
    displayScore: resolveDisplayScore(profile.score, profile.display_score),
    questionsAnswered: profile.questions_answered,
    totalQuestions: profile.total_questions,
    message: profile.tier_config.message_body,
    messageSummary: summary,
    messageRecommendation: recommendation,
  };
}
