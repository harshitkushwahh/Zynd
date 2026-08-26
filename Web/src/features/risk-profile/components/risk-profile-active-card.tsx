"use client";

import { Loader2, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import { RiskProfileGauge } from "@/features/risk-profile/components/risk-profile-gauge";
import { RiskProfileLiquidProgress } from "@/features/risk-profile/components/risk-profile-liquid-progress";
import {
  RISK_PROFILE_PLACEHOLDER_SCORE,
  RISK_PROFILE_PLACEHOLDER_TIER,
  formatRiskTierBadgeLabel,
  resolveDisplayScore,
  resolveRiskTierVisual,
  resolveTierMessageParts,
} from "@/features/risk-profile/lib/risk-tier-ui";
import {
  DASHBOARD_ACTIVE_PAGE_LABEL_CLASS,
} from "@/components/dashboard/dashboard-layout";
import {
  NavbarPageHoverCardBody,
  NAVBAR_PAGE_HOVER_CARD_CLASS,
  NAVBAR_PAGE_HOVER_CARD_SIDE_OFFSET,
} from "@/components/dashboard/navbar-page-hover-card";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ActiveCardMode = "loading" | "completed" | "progress" | "profile" | "empty";

function useActiveCardMode(): ActiveCardMode {
  const riskProfile = useRiskProfileOptional();

  return useMemo(() => {
    if (!riskProfile || riskProfile.loading) return "loading";
    if (riskProfile.navbarCompletionPulse) return "completed";
    if (riskProfile.assessmentInProgress && riskProfile.assessmentDraftProgress) return "progress";
    if (riskProfile.hasProfile && riskProfile.profile) return "profile";
    return "empty";
  }, [riskProfile]);
}

/** Navbar active card for all `/dashboard/risk-profile` routes (settings + assessment). */
export function RiskProfileActiveCard({
  triggerClassName,
}: {
  triggerClassName?: string;
}) {
  const riskProfile = useRiskProfileOptional();
  const mode = useActiveCardMode();
  const profile = riskProfile?.profile;
  const progress = riskProfile?.assessmentDraftProgress;
  const tierVisual = profile
    ? resolveRiskTierVisual(profile.tier)
    : resolveRiskTierVisual(RISK_PROFILE_PLACEHOLDER_TIER);
  const displayScore = profile
    ? resolveDisplayScore(profile.score, profile.display_score)
    : RISK_PROFILE_PLACEHOLDER_SCORE / 10;
  const messageParts = profile ? resolveTierMessageParts(profile.tier_config) : null;

  const hoverTitle =
    mode === "progress" && progress
      ? copy.riskProfile.navbarStepsCompleted(progress.current, progress.total)
      : mode === "completed"
        ? copy.riskProfile.navbarAssessmentComplete
        : profile
          ? `${tierVisual.label} · ${displayScore}/100`
          : copy.riskProfile.lockedGaugeTitle;

  const hoverDescription =
    mode === "progress"
      ? copy.riskProfile.continueAction
      : mode === "completed"
        ? copy.riskProfile.assessmentResultDescription
        : messageParts?.summary || copy.riskProfile.settingsDescription;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        closeDelay={120}
        render={
          <button
            type="button"
            className={cn(
              triggerClassName ??
                cn(
                  DASHBOARD_NAV_ITEM_CLASS,
                  "w-full max-w-[14.5rem] justify-center text-center outline-none text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                ),
              "overflow-hidden",
            )}
            aria-label={copy.riskProfile.settingsTitle}
          />
        }
      >
        {mode === "loading" ? (
          <Loader2 className="size-4 shrink-0 animate-spin opacity-70" aria-hidden />
        ) : mode === "completed" ? (
          <span className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap px-0 text-[11px] font-semibold uppercase tracking-wide text-primary transition-opacity duration-200">
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
            {copy.riskProfile.navbarAssessmentComplete}
          </span>
        ) : mode === "progress" && progress ? (
          <RiskProfileLiquidProgress current={progress.current} total={progress.total} />
        ) : mode === "profile" && profile ? (
          <span className="inline-flex h-10 items-center gap-1.5 px-0 transition-opacity duration-200">
            <RiskProfileGauge
              score={profile.score}
              displayScore={displayScore}
              tier={profile.tier}
              size="navbar"
              showCaption={false}
            />
            <span
              className={cn(
                "max-w-[9.5rem] shrink-0 truncate whitespace-nowrap text-[11px] font-semibold tracking-wide",
                tierVisual.textClass,
              )}
            >
              {formatRiskTierBadgeLabel(profile.tier)}
            </span>
          </span>
        ) : (
          <span className="inline-flex h-10 items-center gap-1.5 px-0 transition-opacity duration-200">
            <RiskProfileGauge
              score={RISK_PROFILE_PLACEHOLDER_SCORE}
              tier={RISK_PROFILE_PLACEHOLDER_TIER}
              size="navbar"
              showCaption={false}
            />
            <span className={cn(DASHBOARD_ACTIVE_PAGE_LABEL_CLASS, "text-[11px] font-medium text-muted-foreground")}>
              {copy.riskProfile.startAction}
            </span>
          </span>
        )}
      </HoverCardTrigger>

      <HoverCardContent
        side="bottom"
        align="end"
        sideOffset={NAVBAR_PAGE_HOVER_CARD_SIDE_OFFSET}
        className={NAVBAR_PAGE_HOVER_CARD_CLASS}
      >
        <NavbarPageHoverCardBody
          title={hoverTitle}
          description={hoverDescription}
          leading={
            profile && mode === "profile" ? (
              <RiskProfileGauge
                score={profile.score}
                displayScore={displayScore}
                tier={profile.tier}
                size="navbar"
                showCaption={false}
              />
            ) : (
              <RiskProfileGauge
                score={RISK_PROFILE_PLACEHOLDER_SCORE}
                tier={RISK_PROFILE_PLACEHOLDER_TIER}
                size="navbar"
                showCaption={false}
              />
            )
          }
        />
      </HoverCardContent>
    </HoverCard>
  );
}
