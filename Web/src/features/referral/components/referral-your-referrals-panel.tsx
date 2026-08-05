"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationPageMinimalCenter } from "@/components/core/table";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageTitle } from "@/components/ui/page-title";
import { ReferralListRow } from "@/features/referral/components/referral-list-row";
import { ReferralYourReferralsEmptyState } from "@/features/referral/components/referral-your-referrals-empty-state";
import { ReferralYourReferralsSkeleton } from "@/features/referral/components/referral-skeleton";
import { ReferralSummaryStatCards } from "@/features/referral/components/referral-summary-stat-cards";
import { useReferralListQuery } from "@/features/referral/hooks/use-referral-list-query";
import {
  filterReferralsByPeriod,
  mapReferralDisplayItems,
  REFERRAL_LIST_PAGE_SIZE,
  sumEarningsThisMonth,
  summarizeReferralDisplayItems,
  type ReferralsPeriod,
} from "@/features/referral/lib/referral-display";
import { REFERRAL_CARD_RADIUS_CLASS } from "@/features/referral/lib/referral-ui";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const referralRouteLabel =
  DASHBOARD_ROUTES.find((route) => route.id === "referral")?.label ?? "Referrals";

type StatusFilter = "all" | "1" | "2" | "3";

const REFERRALS_PERIOD_OPTIONS: { value: ReferralsPeriod; label: string }[] = [
  { value: "this_month", label: copy.referral.leaderboardPeriodThisMonth },
  { value: "last_3_months", label: copy.referral.earningsPeriodLast3Months },
  { value: "all_time", label: copy.referral.earningsPeriodAllTime },
];

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: copy.referral.referralsFilterAll },
  { value: "1", label: copy.referral.referralsFilterOnboarded },
  { value: "2", label: copy.referral.referralsFilterKyc },
  { value: "3", label: copy.referral.referralsFilterInvested },
];

function ReferralYourReferralsBreadcrumb() {
  return (
    <DashboardBreadcrumb
      items={[
        { label: referralRouteLabel, href: "/dashboard/referral" },
        { label: copy.referral.referralsPageTitle },
      ]}
    />
  );
}

export function ReferralYourReferralsPanel() {
  const { referrals, showSkeleton, errorMessage, isFetching, refetch } = useReferralListQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [period, setPeriod] = useState<ReferralsPeriod>("this_month");
  const [page, setPage] = useState(1);

  const periodLabel =
    REFERRALS_PERIOD_OPTIONS.find((option) => option.value === period)?.label ??
    copy.referral.leaderboardPeriodThisMonth;

  const loadReferrals = () => refetch();

  const periodReferrals = useMemo(
    () => filterReferralsByPeriod(referrals, period),
    [referrals, period]
  );
  const displayItems = useMemo(() => mapReferralDisplayItems(periodReferrals), [periodReferrals]);
  const summary = useMemo(() => summarizeReferralDisplayItems(displayItems), [displayItems]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return displayItems.filter((item) => {
      const matchesStatus =
        statusFilter === "all" || item.progressStep === Number(statusFilter);
      const matchesSearch =
        query.length === 0 ||
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [displayItems, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / REFERRAL_LIST_PAGE_SIZE));

  const pageItems = useMemo(() => {
    const start = (page - 1) * REFERRAL_LIST_PAGE_SIZE;
    return filteredItems.slice(start, start + REFERRAL_LIST_PAGE_SIZE);
  }, [filteredItems, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, period]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const summaryStats = {
    signup_count: summary.totalCount,
    qualified_count: summary.successfulCount,
  };
  const hasNoReferrals = referrals.length === 0;

  if (showSkeleton && !errorMessage && referrals.length === 0) {
    return <ReferralYourReferralsSkeleton />;
  }

  if (errorMessage) {
    return (
      <>
        <ReferralYourReferralsBreadcrumb />
        <LoadErrorCard
          title={copy.referral.loadFailedTitle}
          description={errorMessage}
          retryLabel={copy.referral.retry}
          retryLoading={isFetching}
          onRetry={() => void loadReferrals()}
          icon={Users}
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
      <ReferralYourReferralsBreadcrumb />

      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Users className="size-5 text-primary" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <PageTitle>{copy.referral.referralsPageTitle}</PageTitle>
              <p className="mt-1 text-compact text-muted-foreground">{copy.referral.referralsPageSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Select
              value={period}
              onValueChange={(value) => setPeriod((value ?? "this_month") as ReferralsPeriod)}
            >
              <SelectTrigger className="h-9 w-full min-w-[9.5rem] sm:w-[10.5rem]">
                <SelectValue>{periodLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                {REFERRALS_PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ReferralSummaryStatCards
          stats={summaryStats}
          referrals={periodReferrals}
          totalEarningsInr={summary.totalEarningsInr}
          earningsThisMonthInr={sumEarningsThisMonth(referrals)}
        />

        <section className={cn("flex flex-col border border-border bg-card p-4 sm:p-5", REFERRAL_CARD_RADIUS_CLASS)}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {!hasNoReferrals ? (
              <p className="text-compact font-semibold text-foreground">
                {copy.referral.referralsTotalCount.replace("{count}", String(filteredItems.length))}
              </p>
            ) : (
              <p className="text-compact font-semibold text-foreground">{copy.referral.referralsTitle}</p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[15rem]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={copy.referral.referralsSearchPlaceholder}
                  className="h-8 pl-8"
                  aria-label={copy.referral.referralsSearchPlaceholder}
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter((value ?? "all") as StatusFilter)}
              >
                <SelectTrigger className="h-8 w-full min-w-[10.5rem] sm:w-[11.5rem]">
                  <SelectValue>
                    {STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label ??
                      copy.referral.referralsFilterAll}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {pageItems.length === 0 ? (
            hasNoReferrals ? (
              <ReferralYourReferralsEmptyState className="mt-4 flex-1" />
            ) : (
              <p className="mt-6 text-center text-compact text-muted-foreground">
                {copy.referral.referralsFilterEmpty}
              </p>
            )
          ) : (
            <div className="mt-4 flex flex-col gap-2.5">
              {pageItems.map((item) => (
                <ReferralListRow
                  key={item.id}
                  name={item.name}
                  subtitle={item.email}
                  imageUrl={item.profileImageUrl}
                  progressStep={item.progressStep}
                  showProgressRing
                />
              ))}
            </div>
          )}

          {filteredItems.length > REFERRAL_LIST_PAGE_SIZE ? (
            <PaginationPageMinimalCenter
              page={page}
              total={totalPages}
              onPageChange={setPage}
              className="mt-2 border-t-0 px-0 pb-0 pt-4"
            />
          ) : null}

          {hasNoReferrals ? (
            <p className="mt-auto shrink-0 pt-3 text-center text-caption text-muted-foreground/55">
              {copy.referral.referralsTotalCount.replace("{count}", "0")}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
