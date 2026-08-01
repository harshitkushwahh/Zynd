import type { DistributorClientProfile, DistributorClientRiskAssessment } from "@/lib/dummy/types";
import { hasAssessedRiskProfile, resolveClientRiskGauge } from "@/lib/client-risk-gauge";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";

export function buildDemoClientRiskAssessments(
  profile: DistributorClientProfile,
): DistributorClientRiskAssessment[] {
  if (!hasAssessedRiskProfile(profile)) return [];

  const current = resolveClientRiskGauge(profile);
  const currentVisual = resolveRiskTierVisual(current.tier);
  const nowMs = Date.now();
  const priorTier =
    current.tier === "moderate"
      ? "conservative"
      : current.tier === "growth"
        ? "moderate"
        : "moderate";
  const priorScore = Math.max(10, current.displayScore - 12);
  const priorVisual = resolveRiskTierVisual(priorTier);
  const investorId = profile.investor.id;

  const historical = [
    { monthsAgo: 20, displayScore: Math.max(8, current.displayScore - 28), tier: "conservative" as const },
    { monthsAgo: 15, displayScore: Math.max(10, current.displayScore - 22), tier: "conservative" as const },
    { monthsAgo: 10, displayScore: Math.max(12, current.displayScore - 16), tier: priorTier },
    { monthsAgo: 4, displayScore: Math.max(14, current.displayScore - 8), tier: priorTier },
  ];

  const historyRows: DistributorClientRiskAssessment[] = historical.map((row, index) => {
    const visual = resolveRiskTierVisual(row.tier);
    const completedAt = new Date(nowMs - row.monthsAgo * 30 * 24 * 60 * 60 * 1000).toISOString();
    return {
      assessmentId: `${investorId}-risk-hist-${index}`,
      score: row.displayScore * 10,
      displayScore: row.displayScore,
      tier: row.tier,
      completedAt,
      questionsAnswered: 12,
      totalQuestions: 12,
      messageSummary: `${visual.label} risk profile`,
      messageRecommendation: `Historical ${visual.label.toLowerCase()} tolerance.`,
      isCurrent: false,
    };
  });

  return [
    {
      assessmentId: `${investorId}-risk-current`,
      score: current.score,
      displayScore: current.displayScore,
      tier: current.tier,
      completedAt: new Date(nowMs).toISOString(),
      questionsAnswered: 12,
      totalQuestions: 12,
      messageSummary: `${currentVisual.label} risk profile`,
      messageRecommendation: `Suited to a ${currentVisual.label.toLowerCase()} allocation mix on Zynd.`,
      isCurrent: true,
    },
    {
      assessmentId: `${investorId}-risk-prior`,
      score: priorScore * 10,
      displayScore: priorScore,
      tier: priorTier,
      completedAt: new Date(nowMs - 1000 * 60 * 60 * 24 * 120).toISOString(),
      questionsAnswered: 12,
      totalQuestions: 12,
      messageSummary: `${priorVisual.label} risk profile`,
      messageRecommendation: `Prior assessment indicated ${priorVisual.label.toLowerCase()} tolerance.`,
      isCurrent: false,
    },
    ...historyRows,
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
