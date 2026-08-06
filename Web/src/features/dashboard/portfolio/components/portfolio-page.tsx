"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Clock, LineChart } from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageHeader } from "@/components/ui/page-header";
import { PortfolioAllocationPanel } from "@/features/dashboard/portfolio/components/portfolio-allocation-panel";
import { PortfolioHoldingsTable } from "@/features/dashboard/portfolio/components/portfolio-holdings-table";
import { PortfolioOverviewSkeleton } from "@/features/dashboard/portfolio/components/portfolio-overview-skeleton";
import { PortfolioPageTabs } from "@/features/dashboard/portfolio/components/portfolio-page-tabs";
import { PortfolioRedeemUnitsPanel } from "@/features/dashboard/portfolio/components/portfolio-redeem-units-panel";
import { PortfolioSipsPanel } from "@/features/dashboard/portfolio/components/portfolio-sips-panel";
import { PortfolioSummaryCard } from "@/features/dashboard/portfolio/components/portfolio-summary-card";
import { PortfolioTabEmptyState } from "@/features/dashboard/portfolio/components/portfolio-tab-empty-state";
import { PortfolioTransactionsPanel } from "@/features/dashboard/portfolio/components/portfolio-transactions-panel";
import {
  usePortfolioHoldingsQuery,
  usePortfolioSummaryQuery,
} from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { getPortfolioTabMeta } from "@/features/dashboard/portfolio/lib/portfolio-page-tab-meta";
import type { PortfolioPageTab } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import {
  PORTFOLIO_PAGE_HREF,
  parsePortfolioPageTab,
  portfolioTabHref,
} from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";
import { CalendarClock, TrendingUp, Wallet } from "lucide-react";

function toneClass(tone: "positive" | "negative" | "muted") {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-destructive",
    tone === "muted" && "text-muted-foreground",
  );
}

function PortfolioStatCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative" | "muted";
  icon: typeof Wallet;
}) {
  return (
    <div
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "min-w-0 border border-border/60 bg-card p-4 shadow-zynd-low",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3 shrink-0" strokeWidth={2.25} />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "mt-2 text-h4 font-semibold tabular-nums tracking-tight",
          tone ? toneClass(tone) : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-caption tabular-nums text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function PortfolioOverviewPanel() {
  const overview = copy.dashboard.overview;
  const portfolioCopy = copy.dashboard.portfolio;
  const {
    preview,
    flowSeries,
    showDayChange,
    summary,
    showSkeleton: summaryLoading,
    errorMessage: summaryError,
    refetch: refetchSummary,
    isFetching: summaryFetching,
  } = usePortfolioSummaryQuery();
  const {
    holdings,
    showSkeleton: holdingsLoading,
    errorMessage: holdingsError,
    status: holdingsStatus,
    hasPendingOrders,
    refetch: refetchHoldings,
    isFetching: holdingsFetching,
  } = usePortfolioHoldingsQuery();

  const loading = summaryLoading || holdingsLoading;
  const errorMessage = summaryError || holdingsError;

  if (loading) {
    return (
      <>
        <span className="sr-only">{portfolioCopy.overviewLoading}</span>
        <PortfolioOverviewSkeleton />
      </>
    );
  }

  if (errorMessage || !preview || !summary) {
    return (
      <LoadErrorCard
        icon={LineChart}
        title={portfolioCopy.overviewLoadFailed}
        description={errorMessage ?? portfolioCopy.overviewLoadFailedDescription}
        retryLabel={portfolioCopy.retry}
        retryLoading={summaryFetching || holdingsFetching}
        onRetry={() => {
          void refetchSummary();
          void refetchHoldings();
        }}
      />
    );
  }

  const totalReturn = formatSignedReturn(preview.totalReturnPct);
  const showEmpty = holdings.length === 0;
  const showProcessing = showEmpty && (summary.status === "processing" || hasPendingOrders);

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)] lg:items-stretch">
        <div className="flex flex-col gap-3 lg:content-start">
          <PortfolioStatCard
            icon={Wallet}
            label={overview.portfolioInvested}
            value={formatInr(preview.investedInr)}
          />
          <PortfolioStatCard
            icon={TrendingUp}
            label={overview.portfolioReturns}
            value={totalReturn.text}
            sub={formatInr(preview.totalReturnInr)}
            tone={totalReturn.tone}
          />
          <div className="grid grid-cols-2 gap-3">
            <PortfolioStatCard
              icon={TrendingUp}
              label={overview.portfolioXirr}
              value={preview.xirrPct > 0 ? `${preview.xirrPct.toFixed(1)}%` : overview.portfolioXirrUnavailable}
              tone={preview.xirrPct > 0 ? "positive" : "muted"}
            />
            <PortfolioStatCard
              icon={CalendarClock}
              label={overview.portfolioActiveSips}
              value={String(preview.activeSipsCount)}
              sub={`${formatInr(preview.monthlySipInr)}/mo`}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-stretch">
          <PortfolioSummaryCard
            data={preview}
            series={flowSeries}
            showDayChange={showDayChange}
            className="shadow-zynd-low"
          />
          <PortfolioAllocationPanel
            slices={preview.allocation}
            className="min-h-[13.5rem]"
          />
        </div>
      </div>

      {showProcessing ? (
        <PortfolioTabEmptyState
          icon={Clock}
          title={portfolioCopy.overviewProcessingTitle}
          description={portfolioCopy.overviewProcessingDescription}
          className="mt-4"
        />
      ) : null}

      {showEmpty && !showProcessing ? (
        <PortfolioTabEmptyState
          icon={LineChart}
          title={portfolioCopy.overviewEmptyTitle}
          description={
            holdingsStatus === "no_mfia" || holdingsStatus === "mfia_not_ready"
              ? portfolioCopy.overviewMfiaPendingDescription
              : portfolioCopy.overviewEmptyDescription
          }
          className="mt-4"
        />
      ) : null}

      {!showEmpty ? <PortfolioHoldingsTable holdings={holdings} className="mt-4" /> : null}
    </>
  );
}

function portfolioBreadcrumbItems(tab: PortfolioPageTab) {
  const portfolioCopy = copy.dashboard.portfolio;
  const tabMeta = getPortfolioTabMeta(tab);

  if (tab === "overview") {
    return [{ label: tabMeta.breadcrumbLabel }];
  }

  return [
    { label: portfolioCopy.pageTitle, href: PORTFOLIO_PAGE_HREF },
    { label: tabMeta.breadcrumbLabel },
  ];
}

export function PortfolioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parsePortfolioPageTab(searchParams.get("tab"));
  const tabMeta = getPortfolioTabMeta(activeTab);
  const HeaderIcon = tabMeta.icon;

  function handleTabChange(tab: PortfolioPageTab) {
    router.replace(portfolioTabHref(tab), { scroll: false });
  }

  return (
    <div className="w-full min-w-0 pb-8">
      <DashboardBreadcrumb items={portfolioBreadcrumbItems(activeTab)} separator="slash" />

      <PageHeader
        icon={HeaderIcon}
        title={tabMeta.pageTitle}
        action={<PortfolioPageTabs value={activeTab} onChange={handleTabChange} />}
      />

      <div className="mt-6" role="tabpanel">
        {activeTab === "overview" ? <PortfolioOverviewPanel /> : null}
        {activeTab === "sips" ? <PortfolioSipsPanel /> : null}
        {activeTab === "redeem-units" ? <PortfolioRedeemUnitsPanel /> : null}
        {activeTab === "transactions" ? <PortfolioTransactionsPanel /> : null}
      </div>
    </div>
  );
}
