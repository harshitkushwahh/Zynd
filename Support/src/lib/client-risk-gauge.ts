import type { DistributorClientProfile } from "@/lib/distributor-types";
import { normalizeRiskScore, tierIdFromLabel } from "@/lib/risk-profile/risk-tier-ui";

export type ClientRiskGauge = {
  score: number;
  tier: string;
  displayScore: number;
};

export function resolveClientRiskGauge(
  profile: Pick<DistributorClientProfile, "riskProfile" | "riskProfileLabel">,
): ClientRiskGauge | null {
  const risk = profile.riskProfile;
  if (risk?.score != null) {
    const tier = risk.tier?.trim() ? tierIdFromLabel(risk.tier) : tierIdFromLabel(profile.riskProfileLabel);
    return {
      score: risk.score,
      tier,
      displayScore: risk.displayScore ?? normalizeRiskScore(risk.score),
    };
  }
  return null;
}

export function hasAssessedRiskProfile(
  profile: Pick<DistributorClientProfile, "riskProfile" | "riskProfileLabel">,
) {
  return profile.riskProfile?.score != null;
}
