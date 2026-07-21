import type { StatusBadgeVariant } from "@/components/ui/status-badge";

export type RiskTierId = "secure" | "conservative" | "moderate" | "growth" | "aggressive";

const RISK_TIER_BADGE_VARIANTS: Record<RiskTierId, StatusBadgeVariant> = {
  secure: "info",
  conservative: "success",
  moderate: "warning",
  growth: "warning",
  aggressive: "destructive",
};

export function resolveRiskTierBadgeVariant(tier: string): StatusBadgeVariant {
  const normalized = tier.toLowerCase() as RiskTierId;
  return RISK_TIER_BADGE_VARIANTS[normalized] ?? "neutral";
}
