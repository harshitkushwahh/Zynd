"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RiskProfileDetailDialog } from "@/features/risk-profile/components/risk-profile-detail-dialog";
import { RiskProfileGauge } from "@/features/risk-profile/components/risk-profile-gauge";
import { RiskProfileLockedGauge } from "@/features/risk-profile/components/risk-profile-locked-gauge";
import { RiskTierBadge } from "@/features/risk-profile/components/risk-tier-badge";
import type { RiskProfileCurrent } from "@/features/risk-profile/api/risk-profile-api";
import { mapCurrentProfileToHistoryRow } from "@/features/risk-profile/lib/map-current-profile-row";
import { downloadRiskProfilePdf } from "@/features/risk-profile/lib/risk-profile-pdf-download";
import {
  resolveDisplayScore,
  resolveRiskTierVisual,
  resolveTierMessageParts,
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
  const messageParts = profile ? resolveTierMessageParts(profile.tier_config) : null;
  const profileDetailLine =
    messageParts?.recommendation || messageParts?.summary || "";
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
      <div className="mb-4">
        <h2 className="text-compact font-semibold text-foreground sm:text-body">
          {copy.riskProfile.currentProfileTitle}
        </h2>
      </div>

      {hasProfile && profile && tierVisual ? (
        <div className="flex min-h-0 flex-1 items-center gap-5 sm:gap-6">
          <div className="flex shrink-0 items-center self-center">
            <RiskProfileGauge
              score={profile.score}
              displayScore={profile.display_score}
              tier={profile.tier}
              size="card"
              showCaption={false}
              className="mx-0"
            />
          </div>

          <div className="min-w-0 flex-1 self-center">
            <div className="flex flex-wrap items-center gap-2.5">
              <RiskTierBadge
                tier={profile.tier}
                className="h-8 px-3.5 text-compact font-semibold tracking-wide sm:text-body"
              />
              <span
                className={cn(
                  "text-compact font-semibold tabular-nums sm:text-body",
                  tierVisual.textClass,
                )}
              >
                {displayScore}/100
              </span>
            </div>

            {profileDetailLine ? (
              <p className="mt-2.5 font-normal leading-relaxed text-muted-foreground [font-size:clamp(0.8125rem,0.78rem+0.2vw,0.9375rem)]">
                {profileDetailLine}
              </p>
            ) : null}

            {detailRow ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setDetailOpen(true)}
                >
                  {copy.riskProfile.viewProfileAction}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
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
              </div>
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
