import type { DistributorClientProfile, DistributorClientRiskAssessment } from "@/lib/dummy/types";
import { hasAssessedRiskProfile, resolveClientRiskGauge } from "@/lib/client-risk-gauge";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";

export function buildDemoClientRiskAssessments(
  profile: DistributorClientProfile,
): DistributorClientRiskAssessment[] {
  if (!hasAssessedRiskProfile(profile)) return [];

  const current = resolveClientRiskGauge(profile);
  const currentVisual = resolveRiskTierVisual(current.tier);
  const now = new Date().toISOString();
  const priorTier =
    current.tier === "moderate"
      ? "conservative"
      : current.tier === "growth"
        ? "moderate"
        : "moderate";
  const priorScore = Math.max(10, current.displayScore - 12);
  const priorVisual = resolveRiskTierVisual(priorTier);

  return [
    {
      assessmentId: `${profile.investor.id}-risk-current`,
      score: current.score,
      displayScore: current.displayScore,
      tier: current.tier,
      completedAt: now,
      questionsAnswered: 12,
      totalQuestions: 12,
      messageSummary: `${currentVisual.label} risk profile`,
      messageRecommendation: `Suited to a ${currentVisual.label.toLowerCase()} allocation mix on Zynd.`,
      isCurrent: true,
    },
    {
      assessmentId: `${profile.investor.id}-risk-prior`,
      score: priorScore * 10,
      displayScore: priorScore,
      tier: priorTier,
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
      questionsAnswered: 12,
      totalQuestions: 12,
      messageSummary: `${priorVisual.label} risk profile`,
      messageRecommendation: `Prior assessment indicated ${priorVisual.label.toLowerCase()} tolerance.`,
      isCurrent: false,
    },
  ];
}

export function buildDemoRiskAssessmentAnswers(
  assessmentId: string,
): import("@/lib/dummy/types").DistributorClientRiskAssessmentAnswer[] {
  const prompts = [
    "Investment horizon",
    "Income stability",
    "Market experience",
    "Loss tolerance",
    "Return expectations",
  ];
  return prompts.map((prompt, index) => ({
    questionId: `${assessmentId}-q-${index}`,
    categoryName: "Investor profile",
    prompt,
    helpText: null,
    sortOrder: index + 1,
    selectedOptionLabel: index % 2 === 0 ? "Moderately agree" : "Neutral",
  }));
}
