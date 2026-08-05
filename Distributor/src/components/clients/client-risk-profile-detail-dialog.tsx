"use client";

import { Download, Lightbulb, Loader2 } from "lucide-react";
import { useState } from "react";

import { ClientRiskProfileViewAnswersDialog } from "@/components/clients/client-risk-profile-view-answers-dialog";
import { RiskProfileGauge } from "@/components/risk-profile/risk-profile-gauge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { downloadDistributorClientRiskReport } from "@/lib/distributor-client-risk-api";
import type { DistributorClientRiskAssessment } from "@/lib/dummy/types";
import { formatDistributorDate } from "@/lib/format";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";
import { cn } from "@/lib/utils";
import {
  DISTRIBUTOR_INSET_SECTION_BODY_CLASS,
  DISTRIBUTOR_LABEL_CAPS_TINY_CLASS,
  DISTRIBUTOR_OVERLAY_FOOTER_CLASS,
  DISTRIBUTOR_OVERLAY_HEADER_CLASS,
  DISTRIBUTOR_STACK_MD_CLASS,
} from "@/lib/distributor-layout";
import { env } from "@/lib/env";

type ClientRiskProfileDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: DistributorClientRiskAssessment | null;
  clientReference: string;
};

function formatAssessmentDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ClientRiskProfileDetailDialog({
  open,
  onOpenChange,
  assessment,
  clientReference,
}: ClientRiskProfileDetailDialogProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.riskProfile;
  const [downloading, setDownloading] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(false);

  if (!assessment) return null;

  const tierVisual = resolveRiskTierVisual(assessment.tier);
  const summary = assessment.messageSummary ?? "";
  const recommendation = assessment.messageRecommendation ?? "";

  const handleDownload = async () => {
    if (!env.useBackendClients) return;
    setDownloading(true);
    try {
      await downloadDistributorClientRiskReport(clientReference, assessment.assessmentId);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) setAnswersOpen(false);
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{copy.detailTitle}</DialogTitle>
          <DialogDescription>{copy.detailDescription}</DialogDescription>
        </DialogHeader>
        <DialogContent className="max-w-md gap-0 p-0">
          <div className={DISTRIBUTOR_OVERLAY_HEADER_CLASS}>
            <h2 className="text-compact font-semibold">{copy.detailTitle}</h2>
            <p className="distributor-panel-card__description">{copy.detailDescription}</p>
          </div>
          <div className={cn(DISTRIBUTOR_INSET_SECTION_BODY_CLASS, DISTRIBUTOR_STACK_MD_CLASS)}>
            <div className="flex w-full flex-col items-center">
              <RiskProfileGauge
                score={assessment.score}
                displayScore={assessment.displayScore}
                tier={assessment.tier}
                size="compact"
                showCaption={false}
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <StatusBadge variant="neutral">
                <span className={tierVisual.textClass}>{tierVisual.label}</span>
              </StatusBadge>
              <StatusBadge variant="neutral">
                {formatAssessmentDateTime(assessment.completedAt)}
              </StatusBadge>
            </div>
            <div className="flex justify-center">
              <div className="rounded-[var(--radius-control)] border border-border bg-muted/25 px-3 py-2 text-center">
                <p className={DISTRIBUTOR_LABEL_CAPS_TINY_CLASS}>
                  {copy.scoreLabel}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-compact font-semibold tabular-nums",
                    tierVisual.textClass,
                  )}
                >
                  {assessment.displayScore}/100
                </p>
              </div>
            </div>
            {summary ? (
              <div className="rounded-[var(--radius-5xl)] border border-border bg-muted/20 px-4 py-4">
                <div className="flex gap-3">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-compact font-semibold text-foreground">{summary}</p>
                    {recommendation ? (
                      <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
                        {recommendation}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className={DISTRIBUTOR_OVERLAY_FOOTER_CLASS}>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={downloading || !env.useBackendClients}
              onClick={() => void handleDownload()}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {downloading ? copy.downloadingPdf : copy.downloadPdf}
            </Button>
            <Button type="button" onClick={() => setAnswersOpen(true)}>
              {copy.viewAnswers}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ClientRiskProfileViewAnswersDialog
        open={answersOpen}
        onOpenChange={setAnswersOpen}
        clientReference={clientReference}
        assessmentId={assessment.assessmentId}
      />
    </>
  );
}
