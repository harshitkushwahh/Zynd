"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";

import { ClientDetailEmptyState } from "@/components/clients/client-detail-empty-state";
import { ClientRiskProfileDetailDialog } from "@/components/clients/client-risk-profile-detail-dialog";
import { ClientRiskProfileHeroCard } from "@/components/clients/client-risk-profile-hero-card";
import { ClientRiskProfilePastAssessmentsCard } from "@/components/clients/client-risk-profile-past-assessments-card";
import { ClientRiskProfileTabSkeleton } from "@/components/clients/client-risk-profile-tab-skeleton";
import { ClientRiskProfileTrendsCard } from "@/components/clients/client-risk-profile-trends-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { fetchDistributorClientRiskAssessments } from "@/lib/distributor-client-risk-api";
import type { DistributorClientProfile, DistributorClientRiskAssessment } from "@/lib/distributor-types";

type ClientRiskProfileTabProps = {
  profile: DistributorClientProfile;
  clientReference: string;
};

function resolveCurrentAssessment(
  items: DistributorClientRiskAssessment[],
): DistributorClientRiskAssessment | null {
  return items.find((row) => row.isCurrent) ?? items[0] ?? null;
}

export function ClientRiskProfileTab({ profile, clientReference }: ClientRiskProfileTabProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.riskProfile;
  const [assessments, setAssessments] = useState<DistributorClientRiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DistributorClientRiskAssessment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createHintOpen, setCreateHintOpen] = useState(false);

  useEffect(() => {
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

  const currentAssessment = resolveCurrentAssessment(assessments);
  const pastAssessments = currentAssessment
    ? assessments.filter((row) => row.assessmentId !== currentAssessment.assessmentId)
    : assessments;
  const listRows = currentAssessment ? pastAssessments : assessments;
  const showPastCard = !loading && (currentAssessment != null || assessments.length > 0);

  const openDetail = (row: DistributorClientRiskAssessment) => {
    setSelected(row);
    setDetailOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {loading ? (
          <ClientRiskProfileTabSkeleton />
        ) : currentAssessment ? (
          <div className="distributor-client-risk-top-row">
            <ClientRiskProfileHeroCard
              assessment={currentAssessment}
              clientReference={clientReference}
              className="distributor-client-risk-top-row__hero"
            />
            <ClientRiskProfileTrendsCard
              assessments={assessments}
              current={currentAssessment}
              className="distributor-client-risk-top-row__trends"
            />
          </div>
        ) : assessments.length === 0 ? (
          <ClientDetailEmptyState message={copy.assessmentsEmpty} icon={Gauge} />
        ) : null}

        {showPastCard ? (
          <ClientRiskProfilePastAssessmentsCard
            rows={listRows}
            onRowClick={openDetail}
            onCreateClick={() => setCreateHintOpen(true)}
          />
        ) : null}
      </div>

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
