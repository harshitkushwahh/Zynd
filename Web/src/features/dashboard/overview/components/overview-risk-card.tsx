"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import {
  OVERVIEW_BRAND_CARD_STYLES,
  resolveRiskTierBrandTone,
} from "@/features/dashboard/overview/lib/overview-brand-card-styles";
import {
  resolveDisplayScore,
  resolveRiskTierVisual,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const RISK_CARD_ROW_CLASS = "min-h-[4.5rem]";

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
  const brandTone = profile ? resolveRiskTierBrandTone(profile.tier) : "navy";
  const brandStyles = OVERVIEW_BRAND_CARD_STYLES[brandTone];

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
        <h2 className="text-compact font-semibold text-foreground">{overview.riskTitle}</h2>
        <Link
          href="/dashboard/risk-profile"
          aria-label={overview.riskView}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <ArrowUpRight className="size-4" strokeWidth={2.25} />
        </Link>
      </div>

      <div className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
        {loading && !profile ? (
          <Skeleton className={cn("rounded-[1.15rem]", RISK_CARD_ROW_CLASS)} />
        ) : hasProfile && profile && tierVisual && displayScore != null ? (
          <Link
            href="/dashboard/risk-profile"
            className={cn(
              "flex items-center justify-between gap-3 rounded-[1.15rem] px-3 py-3 shadow-zynd-low transition-transform duration-200 ease-out hover:-translate-y-0.5",
              RISK_CARD_ROW_CLASS,
              brandStyles.card,
            )}
          >
            <div className="min-w-0">
              <p className={cn("truncate text-compact font-semibold", brandStyles.title)}>
                {tierVisual.label}
              </p>
              <p className={cn("mt-0.5 truncate text-[11px]", brandStyles.muted)}>
                {overview.riskTierLabel}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className={cn("text-compact font-semibold tabular-nums", brandStyles.title)}>
                {displayScore}/100
              </p>
              <p className={cn("mt-0.5 text-[9px] uppercase tracking-wide", brandStyles.label)}>
                {overview.riskScoreLabel}
              </p>
            </div>
          </Link>
        ) : (
          <Link
            href="/dashboard/risk-profile/assessment"
            className={cn(
              "flex items-center justify-between gap-3 rounded-[1.15rem] px-3 py-3 shadow-zynd-low transition-transform duration-200 ease-out hover:-translate-y-0.5",
              RISK_CARD_ROW_CLASS,
              OVERVIEW_BRAND_CARD_STYLES.navy.card,
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-compact font-semibold text-primary-foreground">
                {overview.riskEmpty}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-primary-foreground/70">
                {overview.riskEmptyHint}
              </p>
            </div>

            <ArrowUpRight className="size-4 shrink-0 text-primary-foreground/80" strokeWidth={2.25} />
          </Link>
        )}
      </div>
    </section>
  );
}

export function OverviewRiskCardSkeleton({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/60 bg-card",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-8 rounded-full" />
      </div>
      <div className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
        <Skeleton className={cn("rounded-[1.15rem]", RISK_CARD_ROW_CLASS)} />
      </div>
    </section>
  );
}
