"use client";

import { resolveRiskTierVisual } from "@/lib/risk-profile-gauge-ui";
import { cn } from "@/lib/utils";

type RiskProfileTierDialDotProps = {
  tier: string;
  active?: boolean;
  size?: "sm" | "md";
};

export function RiskProfileTierDialDot({
  tier,
  active = false,
  size = "md",
}: RiskProfileTierDialDotProps) {
  const tierVisual = resolveRiskTierVisual(tier);

  return (
    <span
      className={cn("inline-block shrink-0 rounded-full", size === "sm" ? "size-2" : "size-2.5")}
      style={{
        backgroundColor: tierVisual.gaugeColor,
        boxShadow: active
          ? `0 0 0 2px color-mix(in srgb, ${tierVisual.gaugeColor} 35%, transparent)`
          : undefined,
      }}
      aria-hidden
    />
  );
}
