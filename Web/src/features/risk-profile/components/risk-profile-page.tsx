"use client";

import { useMemo } from "react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { RiskProfileAssessmentResultDialog } from "@/features/risk-profile/components/risk-profile-assessment-result-dialog";
import { RiskProfileCurrentCard } from "@/features/risk-profile/components/risk-profile-current-card";
import { RiskProfileHeroCard } from "@/features/risk-profile/components/risk-profile-hero-card";
import { RiskProfileLoadErrorCard } from "@/features/risk-profile/components/risk-profile-load-error-card";
import { RiskProfileHistoryCard } from "@/features/risk-profile/components/risk-profile-history-card";
import { RiskProfileHowItWorksCard } from "@/features/risk-profile/components/risk-profile-how-it-works-card";
import { RiskProfilePageSkeleton } from "@/features/risk-profile/components/risk-profile-page-skeleton";
import { RiskProfileTrendsCard } from "@/features/risk-profile/components/risk-profile-trends-card";
import {
  mapAssessmentHistoryToRows,
  mapAssessmentHistoryToTrendPoints,
} from "@/features/risk-profile/lib/map-assessment-history";
import {
  type RiskProfileHistoryRow,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { copy } from "@/shared/config/copy";

const riskProfileRoute = DASHBOARD_ROUTES.find((route) => route.id === "risk-profile")!;

export function RiskProfilePage() {
  const riskProfile = useRiskProfileOptional();

  const profile = riskProfile?.profile ?? null;
  const loading = riskProfile?.loading ?? true;
  const error = riskProfile?.error ?? null;
  const hasProfile = Boolean(profile);

  const historyRows = useMemo((): RiskProfileHistoryRow[] => {
    return mapAssessmentHistoryToRows(riskProfile?.assessmentHistory ?? []);
  }, [riskProfile?.assessmentHistory]);

  const trendPoints = useMemo(() => {
    return mapAssessmentHistoryToTrendPoints(riskProfile?.assessmentHistory ?? []);
  }, [riskProfile?.assessmentHistory]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <DashboardBreadcrumb items={[{ label: riskProfileRoute.label }]} />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        {loading ? (
          <RiskProfilePageSkeleton />
        ) : error && !profile ? (
          <RiskProfileLoadErrorCard
            title={copy.riskProfile.errors.pageLoadFailedTitle}
            description={error}
            retryLabel={copy.riskProfile.errors.retry}
            onRetry={() => void riskProfile?.retryLoad()}
          />
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,4fr)_minmax(0,3fr)] xl:items-start">
              <div className="flex min-w-0 flex-col gap-4">
                <RiskProfileHeroCard />

                <RiskProfileTrendsCard trendPoints={trendPoints} />

                <RiskProfileHistoryCard rows={historyRows} hasProfile={hasProfile} />
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                <RiskProfileCurrentCard
                  profile={profile}
                  hasProfile={hasProfile}
                  isLocked={riskProfile?.isLocked ?? false}
                />

                <RiskProfileHowItWorksCard />
              </div>
            </div>
          </>
        )}
      </div>

      <RiskProfileAssessmentResultDialog
        open={riskProfile?.showCompletedAssessmentDialog ?? false}
        result={riskProfile?.completedAssessmentResult ?? null}
        onOpenChange={(open) => {
          if (!open) {
            riskProfile?.dismissCompletedAssessmentDialog();
          }
        }}
        onDone={() => {
          riskProfile?.dismissCompletedAssessmentDialog();
        }}
      />
    </div>
  );
}
