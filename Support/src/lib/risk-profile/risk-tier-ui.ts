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

export const RISK_GAUGE_SEGMENTS: Array<{ tier: RiskTierId; min: number; max: number }> = [
  { tier: "secure", min: 0, max: 199 },
  { tier: "conservative", min: 200, max: 399 },
  { tier: "moderate", min: 400, max: 599 },
  { tier: "growth", min: 600, max: 799 },
  { tier: "aggressive", min: 800, max: 1000 },
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

export function tierIdFromLabel(label: string): RiskTierId {
  const normalized = label.trim().toLowerCase();
  if (normalized in RISK_TIER_VISUALS) return normalized as RiskTierId;
  if (normalized.includes("conserv")) return "conservative";
  if (normalized.includes("growth")) return "growth";
  if (normalized.includes("aggress")) return "aggressive";
  if (normalized.includes("secure")) return "secure";
  return "moderate";
}

function buildGaugeSubArcsFromTiers(tiers: Array<{ tier: string; display_score_max: number }>) {
  const sorted = [...tiers].sort((left, right) => left.display_score_max - right.display_score_max);
  return sorted.map((tier, index) => {
    const isLast = index === sorted.length - 1;
    const visual = resolveRiskTierVisual(tier.tier);
    return {
      ...(isLast ? {} : { limit: tier.display_score_max }),
      color: visual.gaugeColor,
      showTick: false,
    };
  });
}

export const RISK_GAUGE_SUB_ARCS = buildGaugeSubArcsFromTiers(
  RISK_GAUGE_SEGMENTS.map((segment) => ({
    tier: segment.tier,
    display_score_max: normalizeRiskScore(segment.max),
  })),
);
