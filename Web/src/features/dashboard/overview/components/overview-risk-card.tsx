"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import {
  OVERVIEW_RISK_LOCKED_DISPLAY_SCORE,
  OVERVIEW_RISK_LOCKED_SCORE,
  OVERVIEW_RISK_LOCKED_TIER,
} from "@/features/dashboard/overview/lib/overview-locked-preview-data";
import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import {
  resolveDisplayScore,
  resolveRiskTierVisual,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const RiskProfileGauge = dynamic(
  () =>
    import("@/features/risk-profile/components/risk-profile-gauge").then(
      (mod) => mod.RiskProfileGauge,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-12 w-20" />,
  },
);

export function OverviewRiskCard({ className }: { className?: string }) {
  const riskProfile = useRiskProfileOptional();
  const overview = copy.dashboard.overview;
  const loading = riskProfile?.loading ?? false;
  const profile = riskProfile?.profile ?? null;
  const hasProfile = Boolean(profile);
  const tierVisual = profile ? resolveRiskTierVisual(profile.tier) : null;
  const displayScore = profile
    ? resolveDisplayScore(profile.score, profile.display_score)
    : null;
  const placeholderTierVisual = resolveRiskTierVisual(OVERVIEW_RISK_LOCKED_TIER);
  const isLocked = !loading && !hasProfile;

  return (
    <Link
      href={hasProfile ? "/dashboard/risk-profile" : "/dashboard/risk-profile/assessment"}
      className={cn(
        "group flex aspect-square min-h-[9.5rem] w-full min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card p-3.5",
        "transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/25 hover:shadow-zynd-mid",
        className,
      )}
    >
      {isLocked ? (
        <div className="relative flex h-full min-h-0 flex-1 flex-col">
          <div className="pointer-events-none flex h-full min-h-0 flex-1 select-none flex-col blur-[5px]">
            <div className="flex items-start justify-between gap-2">
              <p className="text-caption font-semibold text-foreground">{overview.riskTitle}</p>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2.25} />
            </div>
            <div className="flex flex-1 flex-col items-center justify-center py-1">
              <RiskProfileGauge
                score={OVERVIEW_RISK_LOCKED_SCORE}
                displayScore={OVERVIEW_RISK_LOCKED_DISPLAY_SCORE}
                tier={OVERVIEW_RISK_LOCKED_TIER}
                size="mini"
                showCaption={false}
              />
              <p className={cn("mt-1 text-caption font-semibold", placeholderTierVisual.textClass)}>
                {placeholderTierVisual.label}
              </p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {OVERVIEW_RISK_LOCKED_DISPLAY_SCORE}/100
              </p>
            </div>
          </div>
          <OverviewLockedCardBackdrop />
          <OverviewLockedCardOverlay
            compact
            title={overview.riskTitle}
            subtitle={copy.riskProfile.lockedGaugeDescription}
          />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-caption font-semibold text-foreground">{overview.riskTitle}</p>
            <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-1">
            {loading && !profile ? (
              <div className="flex w-full flex-col items-center gap-2">
                <Skeleton className="h-12 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ) : hasProfile && profile && tierVisual && displayScore != null ? (
              <>
                <RiskProfileGauge
                  score={profile.score}
                  displayScore={profile.display_score}
                  tier={profile.tier}
                  size="mini"
                  showCaption={false}
                />
                <p className={cn("mt-1 text-caption font-semibold", tierVisual.textClass)}>
                  {tierVisual.label}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">{displayScore}/100</p>
              </>
            ) : null}
          </div>
        </>
      )}
    </Link>
  );
}

export function OverviewRiskCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex aspect-square min-h-[9.5rem] w-full min-w-0 flex-col justify-between overflow-hidden rounded-[1.75rem] border border-border/60 bg-card p-3.5",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex w-full items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-3.5" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-1">
        <Skeleton className="h-12 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}
