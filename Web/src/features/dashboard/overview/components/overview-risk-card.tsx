"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import { OverviewCompactCardHeader } from "@/features/dashboard/overview/components/overview-compact-card-header";
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
    loading: () => <Skeleton className="h-8 w-[3.25rem]" />,
  },
);

const OVERVIEW_RISK_GAUGE_SIZE = "overview" as const;

const RISK_GAUGE_TILE_CLASS =
  "flex size-11 shrink-0 items-end justify-center overflow-hidden rounded-full border border-border/80 bg-muted/40 shadow-zynd-low";

function RiskGaugeTile({ children }: { children: React.ReactNode }) {
  return <div className={RISK_GAUGE_TILE_CLASS}>{children}</div>;
}

function RiskCardContent({
  gauge,
  tierLabel,
  tierClassName,
  scoreLabel,
}: {
  gauge: React.ReactNode;
  tierLabel: string;
  tierClassName?: string;
  scoreLabel: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-1 text-center">
      {gauge}
      <p className={cn("mt-1 text-caption font-semibold", tierClassName)}>{tierLabel}</p>
      <p className="text-[11px] tabular-nums text-muted-foreground">{scoreLabel}</p>
    </div>
  );
}

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
        "group relative flex aspect-square min-h-[9.5rem] w-full min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card p-3.5 shadow-zynd-low",
        "transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/25 hover:shadow-zynd-mid",
        className,
      )}
    >
      <OverviewCompactCardHeader title={overview.riskTitle} groupHover />

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
      {isLocked ? (
        <div className="relative flex h-full min-h-0 flex-1 flex-col">
          <div className="pointer-events-none flex h-full min-h-0 flex-1 select-none flex-col blur-[5px]">
            <RiskCardContent
              gauge={
                <RiskGaugeTile>
                  <RiskProfileGauge
                    score={OVERVIEW_RISK_LOCKED_SCORE}
                    displayScore={OVERVIEW_RISK_LOCKED_DISPLAY_SCORE}
                    tier={OVERVIEW_RISK_LOCKED_TIER}
                    size={OVERVIEW_RISK_GAUGE_SIZE}
                    showCaption={false}
                  />
                </RiskGaugeTile>
              }
              tierLabel={placeholderTierVisual.label}
              tierClassName={placeholderTierVisual.textClass}
              scoreLabel={`${OVERVIEW_RISK_LOCKED_DISPLAY_SCORE}/100`}
            />
          </div>
          <OverviewLockedCardBackdrop />
          <OverviewLockedCardOverlay
            compact
            title={overview.riskTitle}
            subtitle={copy.riskProfile.lockedGaugeDescription}
          />
        </div>
      ) : (
        <RiskCardContent
          gauge={
            loading && !profile ? (
              <RiskGaugeTile>
                <Skeleton className="h-8 w-[3.25rem]" />
              </RiskGaugeTile>
            ) : hasProfile && profile && tierVisual && displayScore != null ? (
              <RiskGaugeTile>
                <RiskProfileGauge
                  score={profile.score}
                  displayScore={profile.display_score}
                  tier={profile.tier}
                  size={OVERVIEW_RISK_GAUGE_SIZE}
                  showCaption={false}
                />
              </RiskGaugeTile>
            ) : null
          }
          tierLabel={
            loading && !profile
              ? " "
              : hasProfile && tierVisual
                ? tierVisual.label
                : "—"
          }
          tierClassName={tierVisual?.textClass}
          scoreLabel={
            loading && !profile
              ? " "
              : displayScore != null
                ? `${displayScore}/100`
                : "—"
          }
        />
      )}
      </div>
    </Link>
  );
}

export function OverviewRiskCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex aspect-square min-h-[9.5rem] w-full min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card p-3.5 shadow-zynd-low",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-3.5" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-1">
        <Skeleton className="size-11 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}
