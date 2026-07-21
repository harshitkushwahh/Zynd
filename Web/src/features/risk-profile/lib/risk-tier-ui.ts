export type RiskTierId = "secure" | "conservative" | "moderate" | "growth" | "aggressive";

export type RiskTierVisual = {
  label: string;
  badgeVariant: "success" | "warning" | "destructive" | "info" | "neutral";
  badgeClassName: string;
  accentClass: string;
  dotClass: string;
  gaugeColor: string;
  textClass: string;
};

export const RISK_TIER_VISUALS: Record<RiskTierId, RiskTierVisual> = {
  secure: {
    label: "Secure",
    badgeVariant: "success",
    badgeClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    accentClass: "text-emerald-500",
    dotClass: "bg-emerald-500",
    gaugeColor: "#22c55e",
    textClass: "text-emerald-500",
  },
  conservative: {
    label: "Conservative",
    badgeVariant: "success",
    badgeClassName: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
    accentClass: "text-green-500",
    dotClass: "bg-green-500",
    gaugeColor: "#16a34a",
    textClass: "text-green-500",
  },
  moderate: {
    label: "Moderate",
    badgeVariant: "warning",
    badgeClassName: "border-amber-400/30 bg-amber-400/10 text-amber-600 dark:text-amber-400",
    accentClass: "text-amber-400",
    dotClass: "bg-amber-400",
    gaugeColor: "#fbbf24",
    textClass: "text-amber-400",
  },
  growth: {
    label: "Growth",
    badgeVariant: "neutral",
    badgeClassName: "border-orange-400/30 bg-orange-400/10 text-orange-600 dark:text-orange-400",
    accentClass: "text-orange-400",
    dotClass: "bg-orange-400",
    gaugeColor: "#fb923c",
    textClass: "text-orange-400",
  },
  aggressive: {
    label: "Aggressive",
    badgeVariant: "destructive",
    badgeClassName: "border-red-400/30 bg-red-400/10 text-red-600 dark:text-red-400",
    accentClass: "text-red-400",
    dotClass: "bg-red-400",
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

/** Placeholder score/tier shown when the user has not completed an assessment. */
export const RISK_PROFILE_PLACEHOLDER_SCORE = 520;
export const RISK_PROFILE_PLACEHOLDER_TIER: RiskTierId = "moderate";

export const RISK_PROFILE_TREND_PLACEHOLDER_POINTS = [
  { label: "Jan", score: 38 },
  { label: "Apr", score: 52 },
  { label: "Jul", score: 46 },
] as const;

export const RISK_PROFILE_TRENDS_MIN_PROFILES = 3;

export const RISK_PROFILE_DEFAULT_QUESTION_COUNT = 10;

export type RiskProfileHistoryRow = {
  id: string;
  tier: RiskTierId;
  score: number;
  displayScore: number;
  date: string;
  questionsAnswered: number;
  totalQuestions: number;
  message?: string;
  messageSummary?: string;
  messageRecommendation?: string;
};

export const RISK_PROFILE_HISTORY_PLACEHOLDER_ROWS: RiskProfileHistoryRow[] = [
  {
    id: "placeholder-1",
    tier: "moderate",
    score: 520,
    displayScore: 52,
    date: "2026-01-18T10:00:00.000Z",
    questionsAnswered: 10,
    totalQuestions: 10,
  },
  {
    id: "placeholder-2",
    tier: "growth",
    score: 680,
    displayScore: 68,
    date: "2025-10-08T10:00:00.000Z",
    questionsAnswered: 10,
    totalQuestions: 10,
  },
  {
    id: "placeholder-3",
    tier: "conservative",
    score: 350,
    displayScore: 35,
    date: "2025-07-22T10:00:00.000Z",
    questionsAnswered: 10,
    totalQuestions: 10,
  },
];

export function normalizeRiskScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score / 10)));
}

export function resolveDisplayScore(score: number, displayScore?: number | null) {
  return displayScore ?? normalizeRiskScore(score);
}

export function buildGaugeSubArcsFromTiers(tiers: Array<{ tier: string; display_score_max: number }>) {
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

export function resolveRiskTierVisual(tier: string): RiskTierVisual {
  const normalized = tier.toLowerCase() as RiskTierId;
  return RISK_TIER_VISUALS[normalized] ?? RISK_TIER_VISUALS.moderate;
}

export function formatRiskTierBadgeLabel(tier: string) {
  return resolveRiskTierVisual(tier).label.toUpperCase();
}

export function splitRiskTierMessage(message: string) {
  const separatorIndex = message.indexOf(". ");
  if (separatorIndex === -1) {
    return { summary: message, recommendation: "" };
  }

  return {
    summary: message.slice(0, separatorIndex + 1),
    recommendation: message.slice(separatorIndex + 2),
  };
}

export function resolveTierMessageParts(
  tierConfig: {
    message_body: string;
    message_summary?: string;
    message_recommendation?: string;
  } | null | undefined,
) {
  if (!tierConfig) {
    return { summary: "", recommendation: "" };
  }

  const summary = tierConfig.message_summary?.trim();
  const recommendation = tierConfig.message_recommendation?.trim();
  if (summary) {
    return {
      summary,
      recommendation: recommendation ?? "",
    };
  }

  const message = tierConfig.message_body.trim();
  return message ? splitRiskTierMessage(message) : { summary: "", recommendation: "" };
}

export const RISK_PROFILE_CARD_CLASS =
  "overflow-hidden rounded-[var(--radius-card)] border border-border bg-card";

export const RISK_PROFILE_TOP_ROW_MIN_HEIGHT_CLASS = "min-h-[16rem]";

export const RISK_PROFILE_HERO_RADIUS_CLASS = "rounded-[var(--radius-medium)]";

const RISK_PROFILE_HERO_GRADIENT_STOPS =
  "var(--zynd-navy)_0%,var(--zynd-blue-dark)_46%,var(--zynd-blue)_100%";

export const RISK_PROFILE_HERO_GRADIENT_CLASS = `bg-[linear-gradient(145deg,${RISK_PROFILE_HERO_GRADIENT_STOPS})]`;

export const FAMILY_GROUP_HERO_GRADIENT_CLASS = `bg-[linear-gradient(225deg,${RISK_PROFILE_HERO_GRADIENT_STOPS})]`;
