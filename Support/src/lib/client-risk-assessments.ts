import type { DistributorClientProfile, DistributorClientRiskAssessment } from "@/lib/distributor-types";
import { hasAssessedRiskProfile, resolveClientRiskGauge } from "@/lib/client-risk-gauge";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";

/** Summary row from client detail when the full assessments list is not loaded yet. */
export function buildClientRiskAssessmentFromProfile(
  profile: DistributorClientProfile,
): DistributorClientRiskAssessment | null {
  if (!hasAssessedRiskProfile(profile)) return null;

  const current = resolveClientRiskGauge(profile);
  if (!current) return null;

  const currentVisual = resolveRiskTierVisual(current.tier);

  return {
    assessmentId: `${profile.investor.id}-risk-summary`,
    score: current.score,
    displayScore: current.displayScore,
    tier: current.tier,
    completedAt: null,
    questionsAnswered: 0,
    totalQuestions: 0,
    messageSummary: `${currentVisual.label} risk profile`,
    messageRecommendation: undefined,
    isCurrent: true,
  };
}
