"use client";

import type { RiskProfileCurrent } from "@/features/risk-profile/api/risk-profile-api";
import { RiskProfileGauge } from "@/features/risk-profile/components/risk-profile-gauge";
import {
  resolveDisplayScore,
  resolveRiskTierVisual,
  resolveTierMessageParts,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { cn } from "@/lib/utils";

type RiskProfileSearchResultItemProps = {
  profile: RiskProfileCurrent;
  className?: string;
};

/** CommandItem forces descendant SVGs to 16px — reset so the gauge renders at full size. */
const SEARCH_GAUGE_SVG_RESET =
  "[&_.risk-profile-gauge_svg]:!size-auto [&_.risk-profile-gauge_svg]:!max-h-none [&_.risk-profile-gauge_svg]:!max-w-none";

export function RiskProfileSearchResultItem({
  profile,
  className,
}: RiskProfileSearchResultItemProps) {
  const tierVisual = resolveRiskTierVisual(profile.tier);
  const displayScore = resolveDisplayScore(profile.score, profile.display_score);
  const { recommendation, summary } = resolveTierMessageParts(profile.tier_config);
  const detailLine = recommendation || summary;

  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-3.5", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center self-center",
          SEARCH_GAUGE_SVG_RESET,
        )}
      >
        <RiskProfileGauge
          score={profile.score}
          displayScore={profile.display_score}
          tier={profile.tier}
          size="search"
          showCaption={false}
        />
      </div>

      <div className="min-w-0 flex-1 self-center">
        <p className={cn("truncate font-semibold tracking-tight", tierVisual.textClass)}>
          {tierVisual.label} · {displayScore}/100
        </p>

        {detailLine ? (
          <p className="mt-0.5 line-clamp-2 text-caption leading-snug text-muted-foreground">
            {detailLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}
