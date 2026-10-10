import type { DistributorClientProfile, DistributorClientRiskAssessment } from "@/lib/distributor-types";
import { hasAssessedRiskProfile, resolveClientRiskGauge } from "@/lib/client-risk-gauge";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";

export function buildClientRiskAssessmentFromProfile(
  profile: DistributorClientProfile,
): DistributorClientRiskAssessment | null {
  if (!hasAssessedRiskProfile(profile)) return null;

  const current = resolveClientRiskGauge(profile);
  const currentVisual = resolveRiskTierVisual(current.tier);

  return {
    assessmentId: `${profile.investor.id}-risk-current`,
    score: current.score,
    displayScore: current.displayScore,
    tier: current.tier,
    completedAt: new Date().toISOString(),
    questionsAnswered: 12,
    totalQuestions: 12,
    messageSummary: `${currentVisual.label} risk profile`,
    messageRecommendation: `Suited to a ${currentVisual.label.toLowerCase()} allocation mix on Zynd.`,
    isCurrent: true,
  };
}

export function buildDemoClientRiskAssessments(
  profile: DistributorClientProfile,
): DistributorClientRiskAssessment[] {
  const current = buildClientRiskAssessmentFromProfile(profile);
  return current ? [current] : [];
}

export function buildDemoRiskAssessmentAnswers(
  _assessmentId: string,
): import("@/lib/distributor-types").DistributorClientRiskAssessmentAnswer[] {
  return [];
}
