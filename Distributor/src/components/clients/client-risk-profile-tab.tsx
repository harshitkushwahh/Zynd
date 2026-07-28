"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Plus, ShieldHalf } from "lucide-react";

import { ClientDetailEmptyState } from "@/components/clients/client-detail-empty-state";
import { ClientRiskProfileDetailDialog } from "@/components/clients/client-risk-profile-detail-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { buildDemoClientRiskAssessments } from "@/lib/client-risk-assessments";
import { hasAssessedRiskProfile } from "@/lib/client-risk-gauge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { fetchDistributorClientRiskAssessments } from "@/lib/distributor-client-risk-api";
import type { DistributorClientProfile, DistributorClientRiskAssessment } from "@/lib/dummy/types";
import { formatDistributorDate } from "@/lib/format";
import { env } from "@/lib/env";
import { resolveRiskTierVisual } from "@/lib/risk-profile/risk-tier-ui";
import { cn } from "@/lib/utils";

type ClientRiskProfileTabProps = {
  profile: DistributorClientProfile;
  clientReference: string;
};

export function ClientRiskProfileTab({ profile, clientReference }: ClientRiskProfileTabProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.riskProfile;
  const overview = DISTRIBUTOR_CLIENT_COPY.overview;
  const assessed = hasAssessedRiskProfile(profile);
  const [assessments, setAssessments] = useState<DistributorClientRiskAssessment[]>(() =>
    buildDemoClientRiskAssessments(profile),
  );
  const [loading, setLoading] = useState(env.useBackendClients);
  const [selected, setSelected] = useState<DistributorClientRiskAssessment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createHintOpen, setCreateHintOpen] = useState(false);

  useEffect(() => {
    if (!env.useBackendClients) {
      setAssessments(buildDemoClientRiskAssessments(profile));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchDistributorClientRiskAssessments(clientReference)
      .then((items) => {
        if (!cancelled) setAssessments(items);
      })
      .catch(() => {
        if (!cancelled) setAssessments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientReference, profile.investor.id]);

  const openDetail = (row: DistributorClientRiskAssessment) => {
    setSelected(row);
    setDetailOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldHalf className="size-4" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-compact font-semibold text-foreground">{overview.riskProfile}</h2>
              <StatusBadge variant={assessed ? "success" : "neutral"}>
                {assessed ? copy.profileCreatedBadge : copy.notCreatedBadge}
              </StatusBadge>
            </div>
            <p className="mt-0.5 text-caption text-muted-foreground">{copy.tabDescription}</p>
          </div>
        </div>
        <Button type="button" className="shrink-0 gap-1.5" onClick={() => setCreateHintOpen(true)}>
          <Plus className="size-4" />
          {copy.createAction}
        </Button>
      </div>

      <Card className="overflow-hidden border-border bg-card p-0 shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <p className="text-compact font-medium">{copy.assessmentsTitle}</p>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-center text-caption text-muted-foreground">
            {DISTRIBUTOR_CLIENT_COPY.loadingProfile}
          </p>
        ) : assessments.length === 0 ? (
          <ClientDetailEmptyState message={copy.assessmentsEmpty} icon={ShieldHalf} />
        ) : (
          <ul className="divide-y divide-border" aria-label={copy.listAriaLabel}>
            {assessments.map((row) => {
              const visual = resolveRiskTierVisual(row.tier);
              return (
                <li key={row.assessmentId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                    onClick={() => openDetail(row)}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={cn("text-compact font-semibold", visual.textClass)}>
                          {visual.label} · {row.displayScore}/100
                        </p>
                        {row.isCurrent ? (
                          <StatusBadge variant="info">{copy.currentAssessment}</StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        {row.completedAt
                          ? formatDistributorDate(row.completedAt)
                          : "—"}{" "}
                        · {row.questionsAnswered}/{row.totalQuestions} questions
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ClientRiskProfileDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        assessment={selected}
        clientReference={clientReference}
      />

      <Dialog open={createHintOpen} onOpenChange={setCreateHintOpen}>
        <DialogHeader className="sr-only">
          <DialogTitle>{copy.createAction}</DialogTitle>
          <DialogDescription>{copy.createDisabledHint}</DialogDescription>
        </DialogHeader>
        <DialogContent className="max-w-sm">
          <DialogTitle>{copy.createAction}</DialogTitle>
          <DialogDescription>{copy.createDisabledHint}</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
