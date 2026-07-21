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
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ActiveCardMode = "loading" | "completed" | "progress" | "profile" | "empty";

const NAVBAR_CARD_FADE_CLASS = "animate-in fade-in duration-200";

function ActiveCardFadeIn({
  modeKey,
  className,
  children,
}: {
  modeKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div key={modeKey} className={cn(NAVBAR_CARD_FADE_CLASS, className)}>
      {children}
    </div>
  );
}

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
export function RiskProfileActiveCard() {
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
              "inline-flex h-10 w-auto max-w-full items-center justify-center overflow-hidden rounded-[var(--radius-full)] outline-none",
              "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
            aria-label={copy.riskProfile.settingsTitle}
          />
        }
      >
        {mode === "loading" ? (
          <Loader2 className="size-4 shrink-0 animate-spin px-3 opacity-70" aria-hidden />
        ) : mode === "completed" ? (
          <ActiveCardFadeIn modeKey="completed">
            <span className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
              {copy.riskProfile.navbarAssessmentComplete}
            </span>
          </ActiveCardFadeIn>
        ) : mode === "progress" && progress ? (
          <RiskProfileLiquidProgress current={progress.current} total={progress.total} />
        ) : mode === "profile" && profile ? (
          <ActiveCardFadeIn
            modeKey={`profile-${profile.assessment_id}-${profile.tier}`}
            className="inline-flex h-10 items-center gap-1.5 px-2"
          >
            <RiskProfileGauge
              score={profile.score}
              displayScore={displayScore}
              tier={profile.tier}
              size="navbar"
              showCaption={false}
            />
            <span
              className={cn(
                "shrink-0 whitespace-nowrap text-[11px] font-semibold tracking-wide",
                tierVisual.textClass,
              )}
            >
              {formatRiskTierBadgeLabel(profile.tier)}
            </span>
          </ActiveCardFadeIn>
        ) : (
          <ActiveCardFadeIn modeKey="empty" className="inline-flex h-10 items-center gap-1.5 px-2">
            <RiskProfileGauge
              score={RISK_PROFILE_PLACEHOLDER_SCORE}
              tier={RISK_PROFILE_PLACEHOLDER_TIER}
              size="navbar"
              showCaption={false}
            />
            <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-muted-foreground">
              {copy.riskProfile.startAction}
            </span>
          </ActiveCardFadeIn>
        )}
      </HoverCardTrigger>

      <HoverCardContent side="bottom" align="end" className="w-72">
        <div className="flex items-start gap-3">
          {profile && mode === "profile" ? (
            <div className="shrink-0 pt-0.5">
              <RiskProfileGauge
                score={profile.score}
                displayScore={displayScore}
                tier={profile.tier}
                size="navbar"
                showCaption={false}
              />
            </div>
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
              <span className="text-caption font-semibold tabular-nums">
                {mode === "progress" && progress
                  ? `${progress.current}/${progress.total}`
                  : mode === "completed"
                    ? copy.riskProfile.navbarAssessmentComplete
                    : "RP"}
              </span>
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <p className="line-clamp-2 text-compact font-semibold text-foreground">{hoverTitle}</p>
            <p className="text-caption leading-relaxed text-muted-foreground">{hoverDescription}</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
