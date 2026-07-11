"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  fetchReferralLeaderboard,
  fetchReferralList,
  fetchReferralMe,
  type ReferralLeaderboardResponse,
  type ReferralListItem,
} from "@/features/referral/api/referral-api";
import { ReferralEarningsOverviewCard } from "@/features/referral/components/referral-earnings-overview-card";
import { ReferralHowItWorksCard } from "@/features/referral/components/referral-how-it-works-card";
import { ReferralLeaderboardPreviewCard } from "@/features/referral/components/referral-leaderboard-preview-card";
import { ReferralShareHeroCard } from "@/features/referral/components/referral-share-hero-card";
import { ReferralSummaryStatCards } from "@/features/referral/components/referral-summary-stat-cards";
import { ReferralYourReferralsCard } from "@/features/referral/components/referral-your-referrals-card";
import { buildReferralShareUrl } from "@/features/referral/lib/referral-storage";
import { sumEarningsThisMonth, summarizeReferralList } from "@/features/referral/lib/referral-display";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  REFERRAL_LEFT_COLUMN_CLASS,
  REFERRAL_RIGHT_COLUMN_CLASS,
} from "@/features/referral/lib/referral-ui";
import { ReferralDashboardSkeleton } from "@/features/referral/components/referral-skeleton";
import { FieldMessage } from "@/components/ui/ui-message";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { copy } from "@/shared/config/copy";

type ReferralDashboardData = {
  code: string;
  share_url: string;
  click_count: number;
  signup_count: number;
  kyc_verified_count: number;
  first_investment_count: number;
  qualified_count: number;
  engaged_count: number;
};

type ReferralDashboardPanelProps = {
  initialData?: ReferralDashboardData | null;
};

const referralRouteLabel =
  DASHBOARD_ROUTES.find((route) => route.id === "referral")?.label ?? "Referrals";

function ReferralBreadcrumb() {
  return (
    <Breadcrumb className="mb-6 shrink-0">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/dashboard" />}>Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{referralRouteLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function ReferralDashboardPanel({ initialData = null }: ReferralDashboardPanelProps) {
  const [data, setData] = useState(initialData);
  const [referrals, setReferrals] = useState<ReferralListItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<ReferralLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [me, list, leaderboardData] = await Promise.all([
          fetchReferralMe(),
          fetchReferralList(),
          fetchReferralLeaderboard("this_month"),
        ]);
        if (!cancelled) {
          setData(me);
          setReferrals(list.items);
          setLeaderboard(leaderboardData);
        }
      } catch {
        if (!cancelled) setError(copy.referral.loadFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  const shareUrl =
    data?.share_url ??
    (data?.code ? buildReferralShareUrl(data.code) : "");

  if (loading) {
    return <ReferralDashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <>
        <ReferralBreadcrumb />
        <FieldMessage message={error || copy.referral.loadFailed} />
      </>
    );
  }

  const earningsSummary = summarizeReferralList(referrals);

  return (
    <>
      <ReferralBreadcrumb />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <div className={REFERRAL_LEFT_COLUMN_CLASS}>
          <ReferralShareHeroCard shareUrl={shareUrl} code={data.code} />
          <ReferralLeaderboardPreviewCard
            entries={leaderboard?.entries ?? []}
            totalParticipants={leaderboard?.entries.length ?? 0}
          />
          <ReferralHowItWorksCard />
        </div>

        <div className={REFERRAL_RIGHT_COLUMN_CLASS}>
          <ReferralSummaryStatCards
            stats={data}
            referrals={referrals}
            totalEarningsInr={earningsSummary.totalEarningsInr}
            earningsThisMonthInr={sumEarningsThisMonth(referrals)}
          />
          <ReferralEarningsOverviewCard referrals={referrals} />
          <ReferralYourReferralsCard referrals={referrals} className="min-h-0 flex-1" />
        </div>
      </div>
    </>
  );
}
