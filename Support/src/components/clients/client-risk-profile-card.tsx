"use client";

import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";

import { useClientDetailTabNavigation } from "@/components/clients/client-detail-tab-navigation";
import { ClientRiskProfileHeroCard } from "@/components/clients/client-risk-profile-hero-card";
import { RiskProfileGauge } from "@/components/risk-profile/risk-profile-gauge";
import { RiskProfileTierBadge } from "@/components/risk-profile/risk-profile-tier-badge";
import { buildClientRiskAssessmentFromProfile } from "@/lib/client-risk-assessments";
import { hasAssessedRiskProfile, resolveClientRiskGauge } from "@/lib/client-risk-gauge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientProfile } from "@/lib/distributor-types";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";
import { cn } from "@/lib/utils";

type ClientRiskProfileCardProps = {
  profile: DistributorClientProfile;
  clientReference?: string;
  className?: string;
  variant?: "default" | "inline" | "sidebar";
};

export function ClientRiskProfileCard({
  profile,
  clientReference,
  className,
  variant = "default",
}: ClientRiskProfileCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.overview;
  const riskGauge = resolveClientRiskGauge(profile);
  const tierVisual = riskGauge ? resolveRiskTierVisual(riskGauge.tier) : null;
  const assessed = hasAssessedRiskProfile(profile) && riskGauge != null;
  const reference = clientReference ?? profile.investor.clientCode;
  const tabNavigation = useClientDetailTabNavigation();
  const currentAssessment = useMemo(
    () => buildClientRiskAssessmentFromProfile(profile),
    [profile],
  );

  const openRiskProfileTab = () => {
    tabNavigation?.navigateToTab("risk");
  };

  if (variant === "sidebar") {
    return (
      <article className={cn("distributor-client-risk-sidebar-card", className)}>
        <button
          type="button"
          className="distributor-client-risk-sidebar-card__main"
          disabled={!assessed}
          onClick={() => assessed && openRiskProfileTab()}
          aria-label={
            assessed && tierVisual && riskGauge
              ? `${tierVisual.label} risk profile, ${riskGauge.displayScore} out of 100. Open risk profile tab.`
              : copy.riskProfile
          }
        >
          {assessed ? (
            <>
              <div className="distributor-client-risk-sidebar-card__header">
                <p className="distributor-client-risk-sidebar-card__title">{copy.riskProfile.toUpperCase()}</p>
                <ArrowUpRight
                  className="distributor-client-risk-sidebar-card__header-arrow size-4 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </div>
              <div className="distributor-client-risk-sidebar-card__gauge">
                <RiskProfileGauge
                  score={riskGauge.score}
                  tier={riskGauge.tier}
                  displayScore={riskGauge.displayScore}
                  size="compact"
                  showCaption={false}
                  showTierScale={false}
                />
              </div>
              <div className="distributor-client-risk-sidebar-card__summary">
                {riskGauge && tierVisual ? (
                  <>
                    <RiskProfileTierBadge tier={riskGauge.tier} uppercase />
                    <p
                      className={cn(
                        "distributor-client-risk-sidebar-card__score tabular-nums",
                        tierVisual.textClass,
                      )}
                    >
                      {riskGauge.displayScore}/100
                    </p>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="distributor-client-risk-sidebar-card__header">
                <p className="distributor-client-risk-sidebar-card__title">{copy.riskProfile.toUpperCase()}</p>
              </div>
              <p className="distributor-client-risk-sidebar-card__empty">Not assessed</p>
            </>
          )}
        </button>
      </article>
    );
  }

  if (assessed && currentAssessment) {
    return (
      <ClientRiskProfileHeroCard
        assessment={currentAssessment}
        clientReference={reference}
        className={className}
      />
    );
  }

  return (
    <article
      className={cn(
        "distributor-client-risk-sidebar-card flex items-center justify-center p-6",
        className,
      )}
    >
      <p className="text-caption text-muted-foreground">Not assessed</p>
    </article>
  );
}
