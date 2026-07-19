"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";

import {
  fetchReferralLeaderboard,
  fetchReferralList,
  type ReferralLeaderboardPeriod,
  type ReferralLeaderboardResponse,
  type ReferralListItem,
} from "@/features/referral/api/referral-api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldMessage } from "@/components/ui/ui-message";
import { PageTitle } from "@/components/ui/page-title";
import { ReferralLeaderboardPodium } from "@/features/referral/components/referral-leaderboard-podium";
import { ReferralLeaderboardSidebar } from "@/features/referral/components/referral-leaderboard-sidebar";
import { ReferralLeaderboardTable } from "@/features/referral/components/referral-leaderboard-table";
import { ReferralLeaderboardSkeleton } from "@/features/referral/components/referral-skeleton";
import { splitLeaderboardEntries, hasInsufficientLeaderboardTableData } from "@/features/referral/lib/referral-leaderboard-data";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { copy } from "@/shared/config/copy";

const referralRouteLabel =
  DASHBOARD_ROUTES.find((route) => route.id === "referral")?.label ?? "Referrals";

const LEADERBOARD_PERIOD_OPTIONS: { value: ReferralLeaderboardPeriod; label: string }[] = [
  { value: "this_month", label: copy.referral.leaderboardPeriodThisMonth },
  { value: "last_3_months", label: copy.referral.earningsPeriodLast3Months },
  { value: "all_time", label: copy.referral.earningsPeriodAllTime },
];

function ReferralLeaderboardBreadcrumb() {
  return (
    <Breadcrumb className="mb-6 shrink-0">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/dashboard" />}>Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/dashboard/referral" />}>{referralRouteLabel}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{copy.referral.leaderboardPageTitle}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function ReferralLeaderboardPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<ReferralLeaderboardPeriod>("this_month");
  const [leaderboard, setLeaderboard] = useState<ReferralLeaderboardResponse | null>(null);
  const [recentReferrals, setRecentReferrals] = useState<ReferralListItem[]>([]);

  const periodLabel =
    LEADERBOARD_PERIOD_OPTIONS.find((option) => option.value === period)?.label ??
    copy.referral.leaderboardPeriodThisMonth;

  useEffect(() => {
    let cancelled = false;

    async function loadReferrals() {
      try {
        const list = await fetchReferralList();
        if (!cancelled) {
          setRecentReferrals(list.items);
        }
      } catch {
        if (!cancelled) {
          setRecentReferrals([]);
        }
      }
    }

    void loadReferrals();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchReferralLeaderboard(period);
        if (!cancelled) {
          setLeaderboard(data);
        }
      } catch {
        if (!cancelled) {
          setError(copy.referral.loadFailed);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const totalEntries = leaderboard?.entries.length ?? 0;
  const { topThree, tableEntries } = useMemo(
    () => splitLeaderboardEntries(leaderboard?.entries ?? []),
    [leaderboard]
  );
  const insufficientTableData = hasInsufficientLeaderboardTableData(totalEntries);

  if (loading && !leaderboard) {
    return <ReferralLeaderboardSkeleton />;
  }

  if (error) {
    return (
      <>
        <ReferralLeaderboardBreadcrumb />
        <FieldMessage message={error} />
      </>
    );
  }

  return (
    <>
      <ReferralLeaderboardBreadcrumb />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning/10">
                <Trophy className="size-5 text-warning" strokeWidth={2.25} />
              </div>
              <div>
                <PageTitle>{copy.referral.leaderboardPageTitle}</PageTitle>
                <p className="mt-1 text-compact text-muted-foreground">{copy.referral.leaderboardPageSubtitle}</p>
              </div>
            </div>

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
