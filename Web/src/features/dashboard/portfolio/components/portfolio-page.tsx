"use client";

import { TabPanel } from "@/shared/ui/tab-panel";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LineChart } from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageHeader } from "@/components/ui/page-header";
import { PortfolioAllocationPanel } from "@/features/dashboard/portfolio/components/portfolio-allocation-panel";
import { PortfolioHoldingsTable } from "@/features/dashboard/portfolio/components/portfolio-holdings-table";
import { PortfolioOverviewSkeleton } from "@/features/dashboard/portfolio/components/portfolio-overview-skeleton";
import { PortfolioPageTabs } from "@/features/dashboard/portfolio/components/portfolio-page-tabs";
import { PortfolioProcessingBanner } from "@/features/dashboard/portfolio/components/portfolio-processing-banner";
import { PortfolioRedeemUnitsPanel } from "@/features/dashboard/portfolio/components/portfolio-redeem-units-panel";
import { PortfolioSipsPanel } from "@/features/dashboard/portfolio/components/portfolio-sips-panel";
import { PortfolioSummaryCard } from "@/features/dashboard/portfolio/components/portfolio-summary-card";
import { PortfolioUninvestedEmptyState } from "@/features/dashboard/portfolio/components/portfolio-uninvested-empty-state";
import { PortfolioTransactionsPanel } from "@/features/dashboard/portfolio/components/portfolio-transactions-panel";
import { PortfolioUpcomingSipsPanel } from "@/features/dashboard/portfolio/components/portfolio-upcoming-sips-panel";
import { useMfOrdersQuery } from "@/features/invest/hooks/use-mf-orders-query";
import { useMfSipPlansQuery } from "@/features/invest/hooks/use-mf-sip-plans-query";
import {
  getUpcomingHoldingOrders,
  sumUpcomingHoldingOrdersInr,
} from "@/features/invest/lib/mf-transaction-filters";
import { usePortfolioUninvestedEmpty } from "@/features/dashboard/portfolio/hooks/use-portfolio-uninvested-empty";
import {
  usePortfolioHoldingsQuery,
  usePortfolioSummaryQuery,
} from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { usePrefetchPortfolioTabs } from "@/features/dashboard/portfolio/hooks/use-prefetch-portfolio-tabs";
import { getPortfolioTabMeta } from "@/features/dashboard/portfolio/lib/portfolio-page-tab-meta";
import type { PortfolioPageTab } from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import {
  PORTFOLIO_PAGE_HREF,
  parsePortfolioPageTab,
  portfolioTabHref,
} from "@/features/dashboard/portfolio/lib/portfolio-page-tabs";
import {
  buildProcessingPortfolioFlowSeries,
  buildProcessingPortfolioPreview,
} from "@/features/dashboard/portfolio/lib/portfolio-processing-preview";
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
    showUninvestedEmpty,
    isProcessing,
    processingTitle,
    processingDescription,
  } = usePortfolioUninvestedEmpty();
  const { orders } = useMfOrdersQuery(100);
  const upcomingOrders = useMemo(() => getUpcomingHoldingOrders(orders), [orders]);
  const pendingInr = useMemo(() => sumUpcomingHoldingOrdersInr(orders), [orders]);
  const {
    preview,
    flowSeries,
    showDayChange,
    summary,
    showSkeleton: summaryLoading,
    hasResolved: summaryHasResolved,
    errorMessage: summaryError,
    refetch: refetchSummary,
    isFetching: summaryFetching,
  } = usePortfolioSummaryQuery();
  const {
    holdings,
    showSkeleton: holdingsLoading,
    hasResolved: holdingsHasResolved,
    errorMessage: holdingsError,
    refetch: refetchHoldings,
    isFetching: holdingsFetching,
  } = usePortfolioHoldingsQuery();
  const { plans: sipPlans } = useMfSipPlansQuery();

  const hasResolved = summaryHasResolved && holdingsHasResolved;
  const showInitialSkeleton = !hasResolved && (summaryLoading || holdingsLoading);
  const errorMessage = summaryError || holdingsError;
  const hasHoldings = holdings.length > 0;
  const hasUpcoming = upcomingOrders.length > 0;
  const showPortfolioOverview = hasHoldings || isProcessing || hasUpcoming;

  const displayPreview = useMemo(() => {
    if (preview && hasHoldings) return preview;
    if (isProcessing && pendingInr > 0) return buildProcessingPortfolioPreview(pendingInr, summary);
    return preview;
  }, [preview, hasHoldings, isProcessing, pendingInr, summary]);

  const displaySeries = useMemo(() => {
    if (flowSeries.length > 0) return flowSeries;
    if (isProcessing && pendingInr > 0) return buildProcessingPortfolioFlowSeries(pendingInr);
    return flowSeries;
  }, [flowSeries, isProcessing, pendingInr]);

  if (showInitialSkeleton) {
    return (
      <>
        <span className="sr-only">{portfolioCopy.overviewLoading}</span>
        <PortfolioOverviewSkeleton />
      </>
    );
  }

  if (!hasResolved && errorMessage) {
    return (
      <DashboardContentFade>
        <LoadErrorCard
          icon={LineChart}
          title={portfolioCopy.overviewLoadFailed}
          description={errorMessage}
          retryLabel={portfolioCopy.retry}
          retryLoading={summaryFetching || holdingsFetching}
          onRetry={() => {
            void refetchSummary();
            void refetchHoldings();
          }}
        />
      </DashboardContentFade>
    );
  }

  if (showUninvestedEmpty && !hasUpcoming) {
    return (
      <DashboardContentFade>
        <PortfolioUninvestedEmptyState />
      </DashboardContentFade>
    );
  }

  if (!showPortfolioOverview || !displayPreview) {
    return null;
  }

  const totalReturn = formatSignedReturn(displayPreview.totalReturnPct);

  return (
    <DashboardContentFade>
      {isProcessing ? (
        <PortfolioProcessingBanner title={processingTitle} description={processingDescription} />
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)] lg:items-stretch">
        <div className="flex flex-col gap-3 lg:content-start">
          <PortfolioStatCard
            icon={Wallet}
            label={overview.portfolioInvested}
            value={formatInr(displayPreview.investedInr)}
          />
          <PortfolioStatCard
            icon={TrendingUp}
            label={overview.portfolioReturns}
            value={totalReturn.text}
            sub={formatInr(displayPreview.totalReturnInr)}
            tone={totalReturn.tone}
          />
          <div className="grid grid-cols-2 gap-3">
            <PortfolioStatCard
              icon={TrendingUp}
              label={overview.portfolioXirr}
              value={displayPreview.xirrPct > 0 ? `${displayPreview.xirrPct.toFixed(1)}%` : overview.portfolioXirrUnavailable}
              tone={displayPreview.xirrPct > 0 ? "positive" : "muted"}
            />
            <PortfolioStatCard
              icon={CalendarClock}
              label={overview.portfolioActiveSips}
              value={String(displayPreview.activeSipsCount)}
              sub={`${formatInr(displayPreview.monthlySipInr)}/mo`}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_15rem] lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-stretch">
          <PortfolioSummaryCard
            data={displayPreview}
            series={displaySeries}
            showDayChange={showDayChange && hasHoldings}
            className="shadow-zynd-low"
          />
          <PortfolioAllocationPanel
            slices={displayPreview.allocation}
            className="min-h-[13.5rem]"
          />
        </div>
      </div>

      {summary?.upcoming_sips?.length ? (
        <PortfolioUpcomingSipsPanel upcomingSips={summary.upcoming_sips} className="mt-4" />
      ) : null}

      {hasHoldings || hasUpcoming ? (
        <PortfolioHoldingsTable
          holdings={holdings}
          upcomingOrders={upcomingOrders}
          sipPlans={sipPlans}
          className="mt-4"
        />
      ) : null}
    </DashboardContentFade>
  );
}

function PortfolioTabPanel({
  tab,
  activeTab,
  children,
}: {
  tab: PortfolioPageTab;
  activeTab: PortfolioPageTab;
  children: ReactNode;
}) {
  return (
    <TabPanel active={tab === activeTab}>
      {children}
    </TabPanel>
  );
}

function readPortfolioTabFromLocation() {
  if (typeof window === "undefined") {
    return "overview" satisfies PortfolioPageTab;
  }

  return parsePortfolioPageTab(new URLSearchParams(window.location.search).get("tab"));
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
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PortfolioPageTab>(() =>
    parsePortfolioPageTab(searchParams.get("tab")),
  );
  const tabMeta = getPortfolioTabMeta(activeTab);
  const HeaderIcon = tabMeta.icon;

  usePrefetchPortfolioTabs();

  useEffect(() => {
    setActiveTab(parsePortfolioPageTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    function handlePopState() {
      setActiveTab(readPortfolioTabFromLocation());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function handleTabChange(tab: PortfolioPageTab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    window.history.replaceState(window.history.state, "", portfolioTabHref(tab));
  }

  return (
    <div className="w-full min-w-0 pb-8">
      <DashboardBreadcrumb items={portfolioBreadcrumbItems(activeTab)} separator="slash" />

      <PageHeader
        icon={HeaderIcon}
        title={tabMeta.pageTitle}
        action={<PortfolioPageTabs value={activeTab} onChange={handleTabChange} />}
      />

      <div className="mt-6">
        <PortfolioTabPanel tab="overview" activeTab={activeTab}>
          <PortfolioOverviewPanel />
        </PortfolioTabPanel>
        <PortfolioTabPanel tab="sips" activeTab={activeTab}>
          <PortfolioSipsPanel />
        </PortfolioTabPanel>
        <PortfolioTabPanel tab="redeem-units" activeTab={activeTab}>
          <PortfolioRedeemUnitsPanel />
        </PortfolioTabPanel>
        <PortfolioTabPanel tab="transactions" activeTab={activeTab}>
          <PortfolioTransactionsPanel />
        </PortfolioTabPanel>
      </div>
    </div>
  );
}
