"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { RiskProfileGauge } from "@/components/risk-profile/risk-profile-gauge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hasAssessedRiskProfile, resolveClientRiskGauge } from "@/lib/client-risk-gauge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientProfile } from "@/lib/dummy/types";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";
import { formatDistributorDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DISTRIBUTOR_INSET_SECTION_HEADER_CLASS,
  DISTRIBUTOR_INSET_SECTION_ROW_CLASS,
  DISTRIBUTOR_LABEL_CAPS_INLINE_END_CLASS,
  DISTRIBUTOR_LABEL_CAPS_SEMIBOLD_CENTER_CLASS,
  DISTRIBUTOR_OVERLAY_HEADER_CLASS,
  DISTRIBUTOR_RISK_CARD_INLINE_CLASS,
} from "@/lib/distributor-layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ClientRiskProfileCardProps = {
  profile: DistributorClientProfile;
  className?: string;
  variant?: "default" | "inline";
};

type PastAssessmentRow = {
  id: string;
  tier: string;
  displayScore: number;
  date: string;
};

function buildPastAssessments(profile: DistributorClientProfile): PastAssessmentRow[] {
  const current = resolveClientRiskGauge(profile);
  const priorTier =
    current.tier === "moderate"
      ? "conservative"
      : current.tier === "growth"
        ? "moderate"
        : "moderate";
  const priorScore = Math.max(10, current.displayScore - 12);
  const now = new Date().toISOString();

  if (!hasAssessedRiskProfile(profile)) return [];

  return [
    {
      id: "current",
      tier: current.tier,
      displayScore: current.displayScore,
      date: now,
    },
    {
      id: "prior",
      tier: priorTier,
      displayScore: priorScore,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
    },
  ].map((row, index) => ({
    ...row,
    id: `${row.id}-${index}`,
  }));
}

export function ClientRiskProfileCard({
  profile,
  className,
  variant = "default",
}: ClientRiskProfileCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.overview;
  const riskGauge = resolveClientRiskGauge(profile);
  const tierVisual = resolveRiskTierVisual(riskGauge.tier);
  const assessed = hasAssessedRiskProfile(profile);
  const [historyOpen, setHistoryOpen] = useState(false);
  const pastRows = buildPastAssessments(profile);
  const inline = variant === "inline";

  return (
    <>
      <Card
        className={cn(
          "relative flex flex-col border-border bg-card shadow-sm",
          inline ? DISTRIBUTOR_RISK_CARD_INLINE_CLASS : "p-4",
          className,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1 right-1 size-6 text-muted-foreground hover:text-foreground"
          disabled={!assessed}
          onClick={() => setHistoryOpen(true)}
          aria-label="Past risk assessments"
        >
          <ArrowUpRight className="size-3.5" />
        </Button>
        <p className={DISTRIBUTOR_LABEL_CAPS_INLINE_END_CLASS}>
          {copy.riskProfile}
        </p>
        <div
          className={cn(
            "flex flex-col items-center",
            inline ? "mt-1 py-0.5" : "mt-1 flex-1 py-2",
          )}
        >
          {assessed ? (
            inline ? (
              <>
                <RiskProfileGauge
                  score={riskGauge.score}
                  tier={riskGauge.tier}
                  displayScore={riskGauge.displayScore}
                  size="mini"
                  showCaption={false}
                />
                <p className={cn("mt-1", DISTRIBUTOR_LABEL_CAPS_SEMIBOLD_CENTER_CLASS, tierVisual.textClass)}>
                  {tierVisual.label}
                </p>
                <p className="text-caption tabular-nums text-muted-foreground">
                  {riskGauge.displayScore}/100
                </p>
              </>
            ) : (
              <RiskProfileGauge
                score={riskGauge.score}
                tier={riskGauge.tier}
                displayScore={riskGauge.displayScore}
                size="compact"
                showTierScale={false}
              />
            )
          ) : (
            <p className={cn("text-muted-foreground", inline ? "py-3 text-caption" : "py-6 text-compact")}>
              Not assessed
            </p>
          )}
        </div>
      </Card>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogHeader className="sr-only">
          <DialogTitle>Past risk assessments</DialogTitle>
          <DialogDescription>Historical risk profile results for this client.</DialogDescription>
        </DialogHeader>
        <DialogContent className="max-w-sm gap-0 p-0">
          <div className={DISTRIBUTOR_OVERLAY_HEADER_CLASS}>
            <h2 className="text-compact font-semibold">Past assessments</h2>
            <p className="distributor-panel-card__description">
              Read-only history (distributor view).
            </p>
          </div>
          <ul className="divide-y divide-border">
            {pastRows.map((row) => {
              const visual = resolveRiskTierVisual(row.tier);
              return (
                <li key={row.id} className={DISTRIBUTOR_INSET_SECTION_ROW_CLASS}>
                  <div>
                    <p className={cn("font-medium", visual.textClass)}>
                      {visual.label} · {row.displayScore}/100
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {formatDistributorDate(row.date)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
