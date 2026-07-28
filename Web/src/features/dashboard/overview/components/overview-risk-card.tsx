"use client";

import Link from "next/link";
import { ArrowUpRight, Shield } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import { RiskProfileGauge } from "@/features/risk-profile/components/risk-profile-gauge";
import {
  resolveDisplayScore,
  resolveRiskTierVisual,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { ZYND_CARD_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

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

  return (
    <Link
      href="/dashboard/risk-profile"
      className={cn(
        ZYND_CARD_RADIUS_CLASS,
        "group flex aspect-square min-h-[9.5rem] w-full min-w-0 flex-col justify-between border border-border bg-card p-3.5 shadow-zynd-low",
        "transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/25 hover:shadow-zynd-mid",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="flex size-7 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
            <Shield className="size-3.5" strokeWidth={2.25} />
          </span>
          <p className="text-caption font-semibold text-foreground">{overview.riskTitle}</p>
        </div>
        <ArrowUpRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-1">
        {loading && !profile ? (
          <div className="flex w-full flex-col items-center gap-2">
            <Skeleton className="h-12 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ) : hasProfile && profile && tierVisual ? (
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
        ) : (
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-dashed border-border bg-muted/30">
              <Shield className="size-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <p className="text-caption font-medium text-primary">{overview.riskEmpty}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
