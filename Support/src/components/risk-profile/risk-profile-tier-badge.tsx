import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";
import { cn } from "@/lib/utils";

type RiskProfileTierBadgeProps = {
  tier: string;
  className?: string;
  /** Sidebar card uses uppercase tier labels. */
  uppercase?: boolean;
};

export function RiskProfileTierBadge({ tier, className, uppercase = false }: RiskProfileTierBadgeProps) {
  const visual = resolveRiskTierVisual(tier);
  const label = uppercase ? visual.label.toUpperCase() : visual.label;

  return (
    <span
      className={cn("distributor-client-risk-sidebar-card__tier-badge", visual.textClass, className)}
      style={{
        borderColor: visual.gaugeColor,
        color: visual.gaugeColor,
        backgroundColor: `color-mix(in srgb, ${visual.gaugeColor} 14%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}
