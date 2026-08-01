export type RiskTierId = "secure" | "conservative" | "moderate" | "growth" | "aggressive";

export type RiskTierVisual = {
  label: string;
  gaugeColor: string;
  textClass: string;
};

export const RISK_TIER_VISUALS: Record<RiskTierId, RiskTierVisual> = {
  secure: {
    label: "Secure",
    gaugeColor: "#22c55e",
    textClass: "text-emerald-500",
  },
  conservative: {
    label: "Conservative",
    gaugeColor: "#16a34a",
    textClass: "text-green-500",
  },
  moderate: {
    label: "Moderate",
    gaugeColor: "#fbbf24",
    textClass: "text-amber-400",
  },
  growth: {
    label: "Growth",
    gaugeColor: "#fb923c",
    textClass: "text-orange-400",
  },
  aggressive: {
    label: "Aggressive",
    gaugeColor: "#ef4444",
    textClass: "text-red-400",
  },
};

export const RISK_GAUGE_SEGMENT_COLORS = [
  RISK_TIER_VISUALS.secure.gaugeColor,
  RISK_TIER_VISUALS.conservative.gaugeColor,
  RISK_TIER_VISUALS.moderate.gaugeColor,
  RISK_TIER_VISUALS.growth.gaugeColor,
  RISK_TIER_VISUALS.aggressive.gaugeColor,
];

export function normalizeRiskScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score / 10)));
}

export function resolveDisplayScore(score: number, displayScore?: number | null) {
  return displayScore ?? normalizeRiskScore(score);
}

export function resolveRiskTierVisual(tier: string): RiskTierVisual {
  const normalized = tier.toLowerCase() as RiskTierId;
  return RISK_TIER_VISUALS[normalized] ?? RISK_TIER_VISUALS.moderate;
}
