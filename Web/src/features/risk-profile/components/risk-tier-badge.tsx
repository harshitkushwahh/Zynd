"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatRiskTierBadgeLabel,
  resolveRiskTierVisual,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { cn } from "@/lib/utils";

type RiskTierBadgeProps = {
  tier: string;
  className?: string;
};

export function RiskTierBadge({ tier, className }: RiskTierBadgeProps) {
  const tierVisual = resolveRiskTierVisual(tier);

  return (
    <StatusBadge
      variant={tierVisual.badgeVariant}
      showIcon={false}
      className={cn(tierVisual.badgeClassName, className)}
    >
      {formatRiskTierBadgeLabel(tier)}
    </StatusBadge>
  );
}
