"use client";

import { resolveRiskTierVisual } from "@/lib/risk-profile-gauge-ui";
import { cn } from "@/lib/utils";

type RiskProfileTierBadgeProps = {
  tier: string;
  label: string;
  className?: string;
};

export function RiskProfileTierBadge({ tier, label, className }: RiskProfileTierBadgeProps) {
  const tierVisual = resolveRiskTierVisual(tier);

  return (
    <span
      className={cn("admin-risk-profile-tier-badge", className)}
      style={{
        color: tierVisual.gaugeColor,
        backgroundColor: `color-mix(in srgb, ${tierVisual.gaugeColor} 16%, var(--card))`,
        borderColor: `color-mix(in srgb, ${tierVisual.gaugeColor} 38%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}
