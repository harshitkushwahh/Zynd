"use client";

import { useEffect, useState } from "react";
import { Download, Gauge, Lightbulb, Loader2 } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskTierBadge } from "@/features/risk-profile/components/risk-tier-badge";
import {
  preloadRiskProfileGauge,
  RiskProfileGauge,
} from "@/features/risk-profile/components/risk-profile-gauge";
import { RiskProfileViewAnswersDialog } from "@/features/risk-profile/components/risk-profile-view-answers-dialog";
import { downloadRiskProfilePdf } from "@/features/risk-profile/lib/risk-profile-pdf-download";
import {
  resolveDisplayScore,
  resolveRiskTierVisual,
  type RiskProfileHistoryRow,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type RiskProfileDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: RiskProfileHistoryRow | null;
};

function formatAssessmentDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RiskProfileDetailDialog({ open, onOpenChange, row }: RiskProfileDetailDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(false);

  useEffect(() => {
    if (open) {
      void preloadRiskProfileGauge();
    }
  }, [open]);

  if (!row) {
    return null;
  }

  const tierVisual = resolveRiskTierVisual(row.tier);
  const displayScore = row.displayScore;
  const summary = row.messageSummary ?? "";
  const recommendation = row.messageRecommendation ?? "";

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadRiskProfilePdf(row.id);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <BrandDialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) {
            setAnswersOpen(false);
          }
        }}
        title={copy.riskProfile.historyDetailTitle}
        description={copy.riskProfile.historyDetailDescription}
        icon={Gauge}
        maxWidth="md"
      >
      <div className="space-y-5 px-6 py-5">
        <div className="flex w-full flex-col items-center">
          <RiskProfileGauge
            score={row.score}
            displayScore={row.displayScore}
            tier={row.tier}
            showCaption={false}
            className="mx-0 w-full max-w-[11.5rem] shrink-0"
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <RiskTierBadge tier={row.tier} className="tracking-wide" />
          <StatusBadge variant="neutral" showIcon={false}>
            {formatAssessmentDateTime(row.date)}
          </StatusBadge>
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
                <p className={cn("mt-1.5 text-compact font-semibold leading-snug text-foreground")}>
                  {summary}
                </p>
                {recommendation ? (
                  <p className="mt-2 text-compact leading-relaxed text-muted-foreground">{recommendation}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <BrandDialogFooter>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={downloading}
          onClick={() => void handleDownloadPdf()}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {downloading ? copy.riskProfile.historyDownloadPdfLoading : copy.riskProfile.historyDownloadPdf}
        </Button>
        <Button type="button" onClick={() => setAnswersOpen(true)}>
          {copy.riskProfile.historyViewAnswersAction}
        </Button>
      </BrandDialogFooter>
    </BrandDialog>

      <RiskProfileViewAnswersDialog
        open={answersOpen}
        onOpenChange={setAnswersOpen}
        assessmentId={row.id}
      />
    </>
  );
}
