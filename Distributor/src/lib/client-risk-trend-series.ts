import type { DistributorClientRiskAssessment } from "@/lib/distributor-types";

export type RiskAssessmentTrendPoint = {
  assessmentId: string;
  label: string;
  score: number;
  tier: string;
};

export function buildRiskAssessmentTrendSeries(
  assessments: DistributorClientRiskAssessment[],
  options?: { excludeAssessmentId?: string },
): RiskAssessmentTrendPoint[] {
  const withDates = assessments.filter(
    (row) => row.completedAt && row.assessmentId !== options?.excludeAssessmentId,
  );
  if (withDates.length === 0) return [];

  const sorted = [...withDates].sort(
    (a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime(),
  );

  return sorted.map((row) => ({
    assessmentId: row.assessmentId,
    label: new Date(row.completedAt!).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
    }),
    score: row.displayScore,
    tier: row.tier,
  }));
}
