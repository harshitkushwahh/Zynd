"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

import { ClientRiskProfileDetailDialog } from "@/components/clients/client-risk-profile-detail-dialog";
import { RiskProfileGauge } from "@/components/risk-profile/risk-profile-gauge";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { downloadDistributorClientRiskReport } from "@/lib/distributor-client-risk-api";
import type { DistributorClientRiskAssessment } from "@/lib/distributor-types";
import { formatDistributorDate } from "@/lib/format";
import { env } from "@/lib/env";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";
import { cn } from "@/lib/utils";

type ClientRiskProfileHeroCardProps = {
  assessment: DistributorClientRiskAssessment;
  clientReference: string;
  className?: string;
  /** Tighter layout for the client detail sidebar. */
  density?: "default" | "sidebar";
};

export function ClientRiskProfileHeroCard({
  assessment,
  clientReference,
  className,
  density = "default",
}: ClientRiskProfileHeroCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.riskProfile;
  const tierVisual = resolveRiskTierVisual(assessment.tier);
  const summary = assessment.messageSummary ?? "";
  const recommendation = assessment.messageRecommendation ?? "";
  const [downloading, setDownloading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const sidebar = density === "sidebar";

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
      <article
        className={cn(
          "distributor-client-risk-hero-card",
          sidebar && "distributor-client-risk-hero-card--sidebar",
          className,
        )}
      >
        <div className="distributor-client-risk-hero-card__gauge">
          <RiskProfileGauge
            score={assessment.score}
            tier={assessment.tier}
            displayScore={assessment.displayScore}
            size={sidebar ? "mini" : "compact"}
            showCaption={false}
            showTierScale={false}
          />
          <div className="distributor-client-risk-hero-card__score-box">
            <p className={cn("distributor-client-risk-hero-card__score tabular-nums", tierVisual.textClass)}>
              <span className="distributor-client-risk-hero-card__score-value">{assessment.displayScore}</span>
              <span className="distributor-client-risk-hero-card__score-denom">/100</span>
            </p>
          </div>
        </div>
        <div className="distributor-client-risk-hero-card__body">
          <div className="distributor-client-risk-hero-card__head">
            <p className="distributor-client-risk-hero-card__eyebrow">{copy.latestHeroEyebrow}</p>
            {assessment.completedAt ? (
              <p className="distributor-client-risk-hero-card__date tabular-nums">
                {formatDistributorDate(assessment.completedAt)}
              </p>
            ) : null}
          </div>
          <div className="distributor-client-risk-hero-card__meta">
            <StatusBadge variant="info">{tierVisual.label}</StatusBadge>
          </div>
          {summary || recommendation ? (
            <div className="distributor-client-risk-hero-card__copy">
              {summary ? (
                <p className="distributor-client-risk-hero-card__summary">{summary}</p>
              ) : null}
              {recommendation ? (
                <p className="distributor-client-risk-hero-card__recommendation">{recommendation}</p>
              ) : null}
            </div>
          ) : null}
          <div className="distributor-client-risk-hero-card__actions">
            <DistributorActionButton variant="primary" size={sidebar ? "sm" : "default"} onClick={() => setDetailOpen(true)}>
              {copy.viewAction}
            </DistributorActionButton>
            <DistributorActionButton
              variant="outline"
              size={sidebar ? "sm" : "default"}
              className="gap-2"
              disabled={downloading || !env.useBackendClients}
              onClick={() => void handleDownload()}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
              )}
              {downloading ? copy.downloadingPdf : copy.downloadPdf}
            </DistributorActionButton>
          </div>
        </div>
      </article>

      <ClientRiskProfileDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        assessment={assessment}
        clientReference={clientReference}
      />
    </>
  );
}
