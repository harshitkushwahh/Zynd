"use client";

import { Plus } from "lucide-react";

import { RiskProfileGauge } from "@/components/risk-profile/risk-profile-gauge";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientRiskAssessment } from "@/lib/dummy/types";
import { formatDistributorDate } from "@/lib/format";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";
import { cn } from "@/lib/utils";

type ClientRiskProfilePastAssessmentsCardProps = {
  rows: DistributorClientRiskAssessment[];
  onRowClick: (row: DistributorClientRiskAssessment) => void;
  onCreateClick: () => void;
  className?: string;
  emptyMessage?: string;
};

export function ClientRiskProfilePastAssessmentsCard({
  rows,
  onRowClick,
  onCreateClick,
  className,
  emptyMessage,
}: ClientRiskProfilePastAssessmentsCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.riskProfile;

  return (
    <article className={cn("distributor-client-risk-past-card", className)}>
      <header className="distributor-client-risk-past-card__header">
        <h2 className="distributor-client-risk-past-card__title">{copy.pastAssessmentsTitle}</h2>
        <DistributorActionButton variant="primary" className="gap-1.5" onClick={onCreateClick}>
          <Plus className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
          {copy.createAction}
        </DistributorActionButton>
      </header>

      {rows.length === 0 ? (
        <p className="distributor-client-risk-past-card__empty">
          {emptyMessage ?? copy.pastAssessmentsEmpty}
        </p>
      ) : (
        <ul className="distributor-client-risk-past-card__list" aria-label={copy.listAriaLabel}>
          {rows.map((row) => {
            const visual = resolveRiskTierVisual(row.tier);
            return (
              <li key={row.assessmentId}>
                <button
                  type="button"
                  className="distributor-client-risk-past-card__row"
                  onClick={() => onRowClick(row)}
                >
                  <div className="distributor-client-risk-past-card__row-left">
                    <div className="distributor-client-risk-past-card__row-gauge">
                      <RiskProfileGauge
                        score={row.score}
                        tier={row.tier}
                        displayScore={row.displayScore}
                        size="mini"
                        showCaption={false}
                        showTierScale={false}
                      />
                    </div>
                    <StatusBadge variant="info">{visual.label}</StatusBadge>
                    <div className="distributor-client-risk-past-card__score-box">
                      <p className={cn("distributor-client-risk-past-card__score tabular-nums", visual.textClass)}>
                        <span className="distributor-client-risk-past-card__score-value">{row.displayScore}</span>
                        <span className="distributor-client-risk-past-card__score-denom">/100</span>
                      </p>
                    </div>
                  </div>
                  <p className="distributor-client-risk-past-card__row-date tabular-nums">
                    {row.completedAt ? formatDistributorDate(row.completedAt) : "—"}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
