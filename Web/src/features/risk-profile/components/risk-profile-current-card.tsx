"use client";

import { useMemo, useState } from "react";
import { Download, Info, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RiskTierBadge } from "@/features/risk-profile/components/risk-tier-badge";
import { RiskProfileDetailDialog } from "@/features/risk-profile/components/risk-profile-detail-dialog";
import { RiskProfileGauge } from "@/features/risk-profile/components/risk-profile-gauge";
import { RiskProfileLockedGauge } from "@/features/risk-profile/components/risk-profile-locked-gauge";
import type { RiskProfileCurrent } from "@/features/risk-profile/api/risk-profile-api";
import { mapCurrentProfileToHistoryRow } from "@/features/risk-profile/lib/map-current-profile-row";
import { downloadRiskProfilePdf } from "@/features/risk-profile/lib/risk-profile-pdf-download";
import {
  resolveDisplayScore,
  resolveRiskTierVisual,
  RISK_PROFILE_CARD_CLASS,
  RISK_PROFILE_TOP_ROW_MIN_HEIGHT_CLASS,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type RiskProfileCurrentCardProps = {
  profile: RiskProfileCurrent | null;
  hasProfile: boolean;
  isLocked: boolean;
  className?: string;
};

export function RiskProfileCurrentCard({
  profile,
  hasProfile,
  isLocked,
  className,
}: RiskProfileCurrentCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const tierVisual = profile ? resolveRiskTierVisual(profile.tier) : null;
  const displayScore = profile ? resolveDisplayScore(profile.score, profile.display_score) : 0;
  const detailRow = useMemo(
    () => (profile ? mapCurrentProfileToHistoryRow(profile) : null),
    [profile],
  );

  return (
    <section
      className={cn(
        RISK_PROFILE_CARD_CLASS,
        "relative flex w-full min-w-0 flex-col p-4 sm:p-5",
        RISK_PROFILE_TOP_ROW_MIN_HEIGHT_CLASS,
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-compact font-semibold text-foreground sm:text-body">
          {copy.riskProfile.currentProfileTitle}
        </h2>
        {detailRow ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={copy.riskProfile.currentProfileInfoAria}
            onClick={() => setDetailOpen(true)}
          >
            <Info className="size-4" strokeWidth={2.25} />
          </Button>
        ) : null}
      </div>

      {hasProfile && profile && tierVisual ? (
        <div className="flex min-h-0 flex-1 items-center gap-4 sm:gap-5">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <RiskProfileGauge
              score={profile.score}
              displayScore={profile.display_score}
              tier={profile.tier}
              showCaption={false}
              className="mx-0 max-w-[10.5rem]"
            />
            <div
              className={cn(
                "rounded-[var(--radius-control)] border px-2.5 py-1 text-center",
                "border-border bg-muted/25",
              )}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {copy.riskProfile.scoreLabel}
              </p>
              <p className={cn("text-caption font-semibold tabular-nums", tierVisual.textClass)}>
                {displayScore}/100
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 self-center">
            <RiskTierBadge
              tier={profile.tier}
              className="h-8 px-3.5 text-compact font-semibold tracking-wide sm:text-body"
            />
            <p className="mt-3 font-normal leading-relaxed text-muted-foreground [font-size:clamp(0.8125rem,0.78rem+0.2vw,0.9375rem)]">
              {profile.tier_config.message_body}
            </p>
            {detailRow ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 gap-2"
                disabled={downloading}
                aria-label={copy.riskProfile.historyDownloadPdfAria}
                onClick={() => {
                  setDownloading(true);
                  void downloadRiskProfilePdf(detailRow.id).finally(() => setDownloading(false));
                }}
              >
                {downloading ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.25} />
                ) : (
                  <Download className="size-4" strokeWidth={2.25} />
                )}
                {downloading ? copy.riskProfile.historyDownloadPdfLoading : copy.riskProfile.historyDownloadPdf}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <RiskProfileLockedGauge />
      )}

      <RiskProfileDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        row={detailOpen ? detailRow : null}
      />
    </section>
  );
}
