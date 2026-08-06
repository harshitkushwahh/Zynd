"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";

import { type ReferralLeaderboardPeriod } from "@/features/referral/api/referral-api";
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageHeader } from "@/components/ui/page-header";
import { ReferralLeaderboardPodium } from "@/features/referral/components/referral-leaderboard-podium";
import { ReferralLeaderboardSidebar } from "@/features/referral/components/referral-leaderboard-sidebar";
import { ReferralLeaderboardTable } from "@/features/referral/components/referral-leaderboard-table";
import { ReferralLeaderboardSkeleton } from "@/features/referral/components/referral-skeleton";
import {
  useReferralLeaderboardQuery,
  useReferralListQuery,
} from "@/features/referral/hooks/use-referral-list-query";
import { splitLeaderboardEntries, hasInsufficientLeaderboardTableData } from "@/features/referral/lib/referral-leaderboard-data";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const referralRouteLabel =
  DASHBOARD_ROUTES.find((route) => route.id === "referral")?.label ?? "Referrals";

const LEADERBOARD_PERIOD_OPTIONS: { value: ReferralLeaderboardPeriod; label: string }[] = [
  { value: "this_month", label: copy.referral.leaderboardPeriodThisMonth },
  { value: "last_3_months", label: copy.referral.earningsPeriodLast3Months },
  { value: "all_time", label: copy.referral.earningsPeriodAllTime },
];

function ReferralLeaderboardBreadcrumb() {
  return (
    <DashboardBreadcrumb
      items={[
        { label: referralRouteLabel, href: "/dashboard/referral" },
        { label: copy.referral.leaderboardPageTitle },
      ]}
    />
  );
}

export function ReferralLeaderboardPanel() {
  const [period, setPeriod] = useState<ReferralLeaderboardPeriod>("this_month");
  const {
    leaderboard,
    showSkeleton,
    errorMessage,
    isFetching,
    refetch,
    isShowingPreviousData,
  } = useReferralLeaderboardQuery(period);
  const { referrals: recentReferrals } = useReferralListQuery();

  const periodLabel =
    LEADERBOARD_PERIOD_OPTIONS.find((option) => option.value === period)?.label ??
    copy.referral.leaderboardPeriodThisMonth;

  const totalEntries = leaderboard?.entries.length ?? 0;
  const { topThree, tableEntries } = useMemo(
    () => splitLeaderboardEntries(leaderboard?.entries ?? []),
    [leaderboard]
  );
  const insufficientTableData = hasInsufficientLeaderboardTableData(totalEntries);

  if (showSkeleton) {
    return <ReferralLeaderboardSkeleton />;
  }

  if (errorMessage) {
    return (
      <>
        <ReferralLeaderboardBreadcrumb />
        <LoadErrorCard
          title={copy.referral.loadFailedTitle}
          description={errorMessage}
          retryLabel={copy.referral.retry}
          retryLoading={isFetching}
          onRetry={() => void refetch()}
          icon={Trophy}
          backAction={
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/referral" />}>
              {referralRouteLabel}
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <ReferralLeaderboardBreadcrumb />

      <div
        className={cn(
          "flex flex-col gap-6 xl:flex-row xl:items-start transition-opacity duration-200",
          isShowingPreviousData && isFetching && "opacity-70",
        )}
      >
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <PageHeader
              icon={Trophy}
              title={copy.referral.leaderboardPageTitle}
              description={copy.referral.leaderboardPageSubtitle}
              iconClassName="text-warning"
              descriptionClassName="mt-1"
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Select
                value={period}
                onValueChange={(value) => setPeriod((value ?? "this_month") as ReferralLeaderboardPeriod)}
              >
                <SelectTrigger className="h-9 w-full min-w-[9.5rem] sm:w-[10.5rem]">
                  <SelectValue>{periodLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  {LEADERBOARD_PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ReferralLeaderboardPodium entries={topThree} />
          <ReferralLeaderboardTable
            entries={tableEntries}
            insufficientData={insufficientTableData}
          />
        </div>

        <div className="w-full shrink-0 xl:w-[21rem]">
          <ReferralLeaderboardSidebar
            currentUser={
              leaderboard?.currentUser ?? {
                rank: null,
                referralCount: 0,
                earningsInr: 0,
                topPercent: null,
              }
            }
            recentReferrals={recentReferrals}
          />
        </div>
      </div>
    </>
  );
}
