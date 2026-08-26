"use client";

import { ReferralEarningsOverviewCard } from "@/features/referral/components/referral-earnings-overview-card";
import { ReferralHowItWorksCard } from "@/features/referral/components/referral-how-it-works-card";
import { ReferralLeaderboardPreviewCard } from "@/features/referral/components/referral-leaderboard-preview-card";
import { ReferralShareHeroCard } from "@/features/referral/components/referral-share-hero-card";
import { ReferralSummaryStatCards } from "@/features/referral/components/referral-summary-stat-cards";
import { ReferralYourReferralsCard } from "@/features/referral/components/referral-your-referrals-card";
import { useReferralDashboardQuery } from "@/features/referral/hooks/use-referral-dashboard-query";
import { buildReferralShareUrl } from "@/features/referral/lib/referral-storage";
import { sumEarningsThisMonth, summarizeReferralList } from "@/features/referral/lib/referral-display";
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import {
  REFERRAL_LEFT_COLUMN_CLASS,
  REFERRAL_RIGHT_COLUMN_CLASS,
} from "@/features/referral/lib/referral-ui";
import { ReferralDashboardSkeleton } from "@/features/referral/components/referral-skeleton";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { copy } from "@/shared/config/copy";

type ReferralDashboardPanelProps = {
  initialData?: {
    code: string;
    share_url: string;
    click_count: number;
    signup_count: number;
    kyc_verified_count: number;
    first_investment_count: number;
    qualified_count: number;
    engaged_count: number;
  } | null;
};

const referralRouteLabel =
  DASHBOARD_ROUTES.find((route) => route.id === "referral")?.label ?? "Referrals";
const ReferralRouteIcon = DASHBOARD_ROUTES.find((route) => route.id === "referral")?.icon;

function ReferralBreadcrumb() {
  return <DashboardBreadcrumb items={[{ label: referralRouteLabel }]} />;
}

export function ReferralDashboardPanel({ initialData = null }: ReferralDashboardPanelProps) {
  const { data, referrals, leaderboard, showSkeleton, error, isFetching, refetch } =
    useReferralDashboardQuery();

  const resolvedData = data ?? initialData;
  const shareUrl =
    resolvedData?.share_url ??
    (resolvedData?.code ? buildReferralShareUrl(resolvedData.code) : "");

  if (showSkeleton && !resolvedData) {
    return <ReferralDashboardSkeleton />;
  }

  if (error || !resolvedData) {
    return (
      <DashboardContentFade>
        <ReferralBreadcrumb />
        <LoadErrorCard
          title={copy.referral.loadFailedTitle}
          description={error || copy.referral.loadFailed}
          retryLabel={copy.referral.retry}
          retryLoading={isFetching}
          onRetry={() => void refetch()}
          icon={ReferralRouteIcon}
        />
      </DashboardContentFade>
    );
  }

  const earningsSummary = summarizeReferralList(referrals);

  return (
    <DashboardContentFade>
      <ReferralBreadcrumb />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <div className={REFERRAL_LEFT_COLUMN_CLASS}>
          <ReferralShareHeroCard shareUrl={shareUrl} code={resolvedData.code} />
          <ReferralLeaderboardPreviewCard
            entries={leaderboard?.entries ?? []}
            totalParticipants={leaderboard?.entries.length ?? 0}
          />
          <ReferralHowItWorksCard />
        </div>

        <div className={REFERRAL_RIGHT_COLUMN_CLASS}>
          <ReferralSummaryStatCards
            stats={resolvedData}
            referrals={referrals}
            totalEarningsInr={earningsSummary.totalEarningsInr}
            earningsThisMonthInr={sumEarningsThisMonth(referrals)}
          />
          <ReferralEarningsOverviewCard referrals={referrals} />
          <ReferralYourReferralsCard referrals={referrals} className="min-h-0 flex-1" />
        </div>
      </div>
    </DashboardContentFade>
  );
}
