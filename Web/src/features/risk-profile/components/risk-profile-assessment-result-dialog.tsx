"use client";

import { useEffect } from "react";
import { Gauge, Lightbulb } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { RiskTierBadge } from "@/features/risk-profile/components/risk-tier-badge";
import type { RiskProfileResult } from "@/features/risk-profile/api/risk-profile-api";
import {
  preloadRiskProfileGauge,
  RiskProfileGauge,
} from "@/features/risk-profile/components/risk-profile-gauge";
import { fireKycSuccessConfetti } from "@/features/kyc/lib/kyc-success-confetti";
import {
  resolveDisplayScore,
  resolveRiskTierVisual,
  resolveTierMessageParts,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type RiskProfileAssessmentResultDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: RiskProfileResult | null;
  onDone: () => void;
};

export function RiskProfileAssessmentResultDialog({
  open,
  onOpenChange,
  result,
  onDone,
}: RiskProfileAssessmentResultDialogProps) {
  useEffect(() => {
    if (!open) return;
    void preloadRiskProfileGauge();
    fireKycSuccessConfetti();
  }, [open]);

  if (!result) {
    return null;
  }

  const tierVisual = resolveRiskTierVisual(result.tier);
  const displayScore = resolveDisplayScore(result.score, result.display_score);
  const { summary, recommendation } = resolveTierMessageParts(result.tier_config);

  const handleDone = () => {
    onDone();
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.riskProfile.assessmentResultTitle}
      description={copy.riskProfile.assessmentResultDescription}
      icon={Gauge}
      maxWidth="md"
    >
      <div className="space-y-5 px-6 py-5">
        <div className="flex w-full flex-col items-center">
          <RiskProfileGauge
            score={result.score}
            displayScore={result.display_score}
            tier={result.tier}
            showCaption={false}
            className="mx-0 w-full max-w-[11.5rem] shrink-0"
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <RiskTierBadge tier={result.tier} className="tracking-wide" />
        </div>

        <div className="flex justify-center">
          <div className="w-fit min-w-[7.5rem] rounded-[var(--radius-control)] border border-border bg-muted/25 px-3 py-2 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {copy.riskProfile.scoreLabel}
            </p>
            <p className={cn("mt-0.5 text-compact font-semibold tabular-nums sm:text-body", tierVisual.textClass)}>
              {displayScore}/100
            </p>
          </div>
        </div>

        {summary ? (
          <div
            className="relative overflow-hidden rounded-[var(--radius-card)] border border-border/70 shadow-zynd-low"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, ${tierVisual.gaugeColor} 11%, var(--card)) 0%, color-mix(in srgb, ${tierVisual.gaugeColor} 4%, var(--muted)) 100%)`,
            }}
          >
            <div
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: tierVisual.gaugeColor }}
              aria-hidden
            />

            <div className="flex gap-3 px-4 py-4 pl-5">
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border/50 bg-background/70 shadow-zynd-low backdrop-blur-[var(--blur-sm)]"
                style={{
                  color: tierVisual.gaugeColor,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tierVisual.gaugeColor} 18%, transparent)`,
                }}
              >
                <Lightbulb className="size-4" strokeWidth={2.25} aria-hidden />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.riskProfile.historyDetailRecommendationLabel}
                </p>
                <p className={cn("mt-1.5 text-compact font-semibold leading-snug text-foreground")}>{summary}</p>
                {recommendation ? (
                  <p className="mt-2 text-compact leading-relaxed text-muted-foreground">{recommendation}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <BrandDialogFooter>
        <Button type="button" className="min-w-[8.5rem]" onClick={handleDone}>
          {copy.riskProfile.doneAction}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>
  );
}
