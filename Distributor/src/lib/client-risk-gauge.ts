import type { DistributorClientProfile } from "@/lib/dummy/types";
import {
  tierIdFromLabel,
  type RiskTierId,
} from "@/lib/risk-profile/risk-tier-ui";

export function resolveClientRiskGauge(profile: Pick<
  DistributorClientProfile,
  "riskProfile" | "riskProfileLabel"
>) {
  if (profile.riskProfile?.score != null && profile.riskProfile.tier) {
    return {
      score: profile.riskProfile.score,
      tier: profile.riskProfile.tier,
      displayScore: profile.riskProfile.displayScore,
    };
  }

  const tier: RiskTierId = tierIdFromLabel(profile.riskProfileLabel);
  const displayScore =
    tier === "secure"
      ? 18
      : tier === "conservative"
        ? 32
        : tier === "moderate"
          ? 52
          : tier === "growth"
            ? 68
            : 82;

  return {
    score: displayScore * 10,
    tier,
    displayScore,
  };
}

export function hasAssessedRiskProfile(profile: Pick<
  DistributorClientProfile,
  "riskProfile" | "riskProfileLabel"
>) {
  if (profile.riskProfile?.score != null) return true;
  return profile.riskProfileLabel.toLowerCase() !== "not assessed";
}
