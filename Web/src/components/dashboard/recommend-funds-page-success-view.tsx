"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bookmark,
  Briefcase,
  ChevronRight,
  Clock,
  Filter,
  PieChart,
  Shield,
  TrendingDown,
} from "lucide-react";

import "@/styles/zynd-recommend-funds-success.css";
import { mapRecommendFundsAllocationChartSlices } from "@/components/dashboard/recommend-funds-allocation-panel";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { formatInr } from "@/features/invest/lib/mf-format";
import { useFundsForYouFundDetailsQuery } from "@/features/recommendations/hooks/use-funds-for-you-fund-details-query";
import { mapFundsForYouAllocation } from "@/features/recommendations/lib/map-funds-for-you-allocation";
import {
  buildFilterOptions,
  enrichFundsForYouFund,
  FUNDS_FOR_YOU_FILTER_ALL,
  FUNDS_FOR_YOU_PORTFOLIO_LOCKED_ALLOCATION,
  FUNDS_FOR_YOU_PORTFOLIO_LOCKED_VALUE_INR,
  resolveFundsForYouFundHref,
  resolveFundsForYouSortReturnValue,
  resolveRiskHorizonLabel,
  type EnrichedFundsForYouFund,
} from "@/features/recommendations/lib/funds-for-you-success-ui";
import {
  OverviewLockedCardBackdrop,
  OverviewLockedCardOverlay,
} from "@/features/dashboard/overview/components/overview-locked-card-overlay";
import type { PortfolioAllocationChartSlice } from "@/features/dashboard/portfolio/components/portfolio-allocation-donut-chart";
import type { FundsForYouResponse } from "@/features/recommendations/types/funds-for-you";
import { usePortfolioSummaryQuery } from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { mapPortfolioAllocationChartSlices } from "@/features/dashboard/portfolio/components/portfolio-allocation-donut-chart";
import { RiskTierBadge } from "@/features/risk-profile/components/risk-tier-badge";
import {
  preloadRiskProfileGauge,
  RiskProfileGauge,
} from "@/features/risk-profile/components/risk-profile-gauge";
import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import {
  resolveRiskTierVisual,
  resolveTierMessageParts,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PortfolioAllocationDonutChart = dynamic(
  () =>
    import("@/features/dashboard/portfolio/components/portfolio-allocation-donut-chart").then(
      (mod) => mod.PortfolioAllocationDonutChart,
    ),
  {
    ssr: false,
    loading: () => <div className="rf-success-donut-skeleton" aria-hidden />,
  },
);

type RecommendFundsPageSuccessViewProps = {
  data: FundsForYouResponse;
};

type SortMode = "match" | "return_3y";

function FundsForYouSparkline({ points, id }: { points: number[]; id: string }) {
  const width = 72;
  const height = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((value, index) => {
    const x = index * step;
    const y = height - 3 - ((value - min) / range) * (height - 6);
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const gradientId = `rf-success-spark-${id}`;

  return (
    <svg
      className="rf-success-spark"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="#4ade80"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SuccessCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: typeof BarChart3;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rf-success-card", className)}>
      <header className="rf-success-card-head">
        <div className="rf-success-card-title-wrap">
          <span className="rf-success-card-icon" aria-hidden>
            <Icon className="size-4" strokeWidth={2.1} />
          </span>
          <h2 className="rf-success-card-title">{title}</h2>
        </div>
        {action ? (
          <Link href={action.href} className="rf-success-card-link">
            <span>{action.label}</span>
            <ChevronRight className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function RiskMetricRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rf-success-metric-row">
      <span className="rf-success-metric-icon" aria-hidden>
        <Icon className="size-3.5" strokeWidth={2.1} />
      </span>
      <div className="min-w-0">
        <p className="rf-success-metric-label">{label}</p>
        <p className="rf-success-metric-value">{value}</p>
      </div>
    </div>
  );
}

function PortfolioReviewContent({
  slices,
  totalFormatted,
  totalValueLabel,
  selectedSliceId,
  onSelectSlice,
}: {
  slices: PortfolioAllocationChartSlice[];
  totalFormatted: string;
  totalValueLabel: string;
  selectedSliceId: string | null;
  onSelectSlice: (id: string) => void;
}) {
  return (
    <div className="rf-success-portfolio-body">
      <div className="rf-success-portfolio-chart">
        <PortfolioAllocationDonutChart
          slices={slices}
          selectedId={selectedSliceId}
          onSelect={onSelectSlice}
        />
        <div className="rf-success-portfolio-center">
          <p className="rf-success-portfolio-value">{totalFormatted}</p>
          <p className="rf-success-portfolio-value-label">{totalValueLabel}</p>
        </div>
      </div>
      <ul className="rf-success-portfolio-legend">
        {slices.map((slice) => (
          <li key={slice.id}>
            <span className="rf-success-allocation-dot" style={{ backgroundColor: slice.fill }} />
            <span>{slice.label}</span>
            <span className="rf-success-portfolio-legend-pct">{slice.valuePct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecommendedAllocationBar({
  slices,
}: {
  slices: ReturnType<typeof mapRecommendFundsAllocationChartSlices>;
}) {
  if (!slices.length) return null;

  return (
    <div className="rf-success-allocation-bar-wrap">
      <div className="rf-success-allocation-bar" role="img" aria-label="Recommended asset allocation">
        {slices.map((slice) => (
          <div
            key={slice.id}
            className="rf-success-allocation-segment"
            style={{ flexBasis: `${slice.valuePct}%`, backgroundColor: slice.fill }}
            title={`${slice.label} ${slice.valuePct}%`}
          />
        ))}
      </div>
      <div className="rf-success-allocation-legend">
        {slices.map((slice) => (
          <div key={slice.id} className="rf-success-allocation-legend-item">
            <span className="rf-success-allocation-dot" style={{ backgroundColor: slice.fill }} />
            <span className="rf-success-allocation-legend-label">{slice.label}</span>
            <span className="rf-success-allocation-legend-value">{slice.valuePct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FundRow({ fund }: { fund: EnrichedFundsForYouFund }) {
  const pageCopy = copy.navbar.recommendFunds.pageSuccess;
  const fundReturn = fund.fundReturn;
  const href = resolveFundsForYouFundHref(fund, fund.detail);
  const amcLabel = fund.amc_name?.trim() || fund.detail?.amc_name?.trim() || "—";

  return (
    <div className="rf-success-fund-row">
      <MfFundAmcAvatar
        amcLogoUrl={fund.amc_logo_url}
        amcSlug={fund.amc_slug}
        amcName={fund.amc_name}
        size="md"
        className="rf-success-fund-logo"
      />
      <div className="rf-success-fund-main">
        <Link href={href} className="rf-success-fund-name">
          {fund.scheme_name}
        </Link>
        <div className="rf-success-fund-meta">
          <span className="rf-success-fund-amc">{amcLabel}</span>
          <span className="rf-success-match-badge">{fund.matchScore}% {pageCopy.matchLabel}</span>
        </div>
      </div>
      <div className="rf-success-fund-return">
        {fundReturn.hasData ? (
          <p
            className={cn(
              "rf-success-fund-return-value",
              fundReturn.tone === "positive" && "rf-success-fund-return-positive",
              fundReturn.tone === "negative" && "rf-success-fund-return-negative",
            )}
          >
            {fundReturn.shortLabel && fundReturn.shortLabel !== "3Y" ? (
              <span className="rf-success-fund-return-period">{fundReturn.shortLabel} </span>
            ) : null}
            {fundReturn.text}
          </p>
        ) : null}
        {fundReturn.sparkPoints.length > 0 ? (
          <FundsForYouSparkline points={fundReturn.sparkPoints} id={fund.product_id} />
        ) : null}
      </div>
      <div className="rf-success-fund-actions">
        <Button
          type="button"
          nativeButton={false}
          className="rf-success-start-sip"
          render={<Link href={href} />}
        >
          {pageCopy.startSip}
          <ChevronRight className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        </Button>
        <button type="button" className="rf-success-bookmark" aria-label={pageCopy.saveFundAria}>
          <Bookmark className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function RecommendFundsPageSuccessView({ data }: RecommendFundsPageSuccessViewProps) {
  const pageCopy = copy.navbar.recommendFunds.pageSuccess;
  const riskProfile = useRiskProfileOptional();
  const profile = riskProfile?.profile ?? null;
  const tierVisual = profile ? resolveRiskTierVisual(profile.tier) : null;
  const tierMessages = profile ? resolveTierMessageParts(profile.tier_config) : null;
  const horizonLabel = resolveRiskHorizonLabel(profile?.tier ?? data.tier);

  const productIds = useMemo(() => data.funds.map((fund) => fund.product_id), [data.funds]);
  const { data: detailMap } = useFundsForYouFundDetailsQuery(productIds, data.funds.length > 0);

  const enrichedFunds = useMemo(
    () => data.funds.map((fund, index) => enrichFundsForYouFund(fund, index, detailMap)),
    [data.funds, detailMap],
  );

  const filterOptions = useMemo(() => buildFilterOptions(enrichedFunds), [enrichedFunds]);
  const [activeFilter, setActiveFilter] = useState(FUNDS_FOR_YOU_FILTER_ALL);
  const [sortMode, setSortMode] = useState<SortMode>("match");

  const filteredFunds = useMemo(() => {
    const filtered =
      activeFilter === FUNDS_FOR_YOU_FILTER_ALL
        ? enrichedFunds
        : enrichedFunds.filter((fund) => fund.filterId === activeFilter);

    const sorted = [...filtered];
    if (sortMode === "return_3y") {
      sorted.sort(
        (a, b) =>
          resolveFundsForYouSortReturnValue(b.detail?.returns) -
          resolveFundsForYouSortReturnValue(a.detail?.returns),
      );
    } else {
      sorted.sort((a, b) => b.matchScore - a.matchScore);
    }
    return sorted;
  }, [activeFilter, enrichedFunds, sortMode]);

  const recommendedAllocation = useMemo(() => {
    const slices = data.allocation ? mapFundsForYouAllocation(data.allocation) : [];
    return mapRecommendFundsAllocationChartSlices(slices);
  }, [data.allocation]);

  const { preview, summary, showSkeleton: portfolioLoading, hasResolved: portfolioResolved } =
    usePortfolioSummaryQuery();
  const portfolioSlices = useMemo(
    () => mapPortfolioAllocationChartSlices(preview?.allocation ?? []),
    [preview?.allocation],
  );
  const lockedPortfolioSlices = useMemo(
    () => mapPortfolioAllocationChartSlices(FUNDS_FOR_YOU_PORTFOLIO_LOCKED_ALLOCATION),
    [],
  );
  const [selectedPortfolioSlice, setSelectedPortfolioSlice] = useState<string | null>(null);
  const hasLivePortfolio =
    portfolioSlices.length > 0 && (summary?.current_value_inr ?? 0) > 0;
  const isPortfolioLocked = portfolioResolved && !portfolioLoading && !hasLivePortfolio;
  const displayPortfolioSlices = hasLivePortfolio ? portfolioSlices : lockedPortfolioSlices;
  const displayPortfolioTotal = hasLivePortfolio
    ? formatInr(summary!.current_value_inr)
    : formatInr(FUNDS_FOR_YOU_PORTFOLIO_LOCKED_VALUE_INR);

  useEffect(() => {
    void preloadRiskProfileGauge();
  }, []);

  const riskTolerance =
    tierVisual?.label ?? tierMessages?.summary?.split(".")[0] ?? pageCopy.riskToleranceFallback;

  return (
    <div className="rf-success-dashboard">
      <div className="rf-success-badge">{copy.navbar.recommendFunds.label}</div>

      <div className="rf-success-grid">
        <div className="rf-success-sidebar">
          <SuccessCard
            title={pageCopy.riskProfileTitle}
            icon={BarChart3}
            action={{ label: pageCopy.viewAction, href: "/dashboard/risk-profile" }}
          >
            {profile && tierVisual ? (
              <div className="rf-success-risk-body">
                <div className="rf-success-gauge-column">
                  <RiskProfileGauge
                    score={profile.score}
                    displayScore={profile.display_score}
                    tier={profile.tier}
                    size="card"
                    showCaption={false}
                    className="mx-0"
                  />
                  <div className="rf-success-gauge-caption">
                    <RiskTierBadge
                      tier={profile.tier}
                      className="rf-success-risk-tier-badge h-7 px-3 text-[10px] font-semibold tracking-wide"
                    />
                  </div>
                </div>
                <div className="rf-success-metrics">
                  <RiskMetricRow icon={Clock} label={pageCopy.investmentHorizon} value={horizonLabel} />
                  <RiskMetricRow icon={Shield} label={pageCopy.riskTolerance} value={riskTolerance} />
                  <RiskMetricRow
                    icon={Briefcase}
                    label={pageCopy.incomeStability}
                    value={pageCopy.incomeStabilityValue}
                  />
                  <RiskMetricRow
                    icon={TrendingDown}
                    label={pageCopy.lossComfort}
                    value={tierVisual.label}
                  />
                </div>
              </div>
            ) : (
              <p className="rf-success-empty-copy">{pageCopy.riskProfileUnavailable}</p>
            )}
          </SuccessCard>

          <SuccessCard
            title={pageCopy.portfolioReviewTitle}
            icon={PieChart}
            action={{ label: pageCopy.viewPortfolio, href: "/dashboard/portfolio" }}
          >
            {portfolioLoading && !portfolioResolved ? (
              <div className="rf-success-portfolio-loading" aria-busy="true">
                <div className="rf-success-donut-skeleton rf-success-portfolio-loading-chart" />
                <div className="rf-success-portfolio-loading-lines" aria-hidden>
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={`portfolio-skeleton-${index}`} className="rf-success-portfolio-loading-line" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rf-success-portfolio-wrap">
                <div
                  className={cn(isPortfolioLocked && "pointer-events-none select-none blur-[5px]")}
                  aria-hidden={isPortfolioLocked}
                >
                  <PortfolioReviewContent
                    slices={displayPortfolioSlices}
                    totalFormatted={displayPortfolioTotal}
                    totalValueLabel={pageCopy.totalValueLabel}
                    selectedSliceId={selectedPortfolioSlice}
                    onSelectSlice={(id) =>
                      setSelectedPortfolioSlice((current) => (current === id ? null : id))
                    }
                  />
                </div>
                {isPortfolioLocked ? (
                  <>
                    <OverviewLockedCardBackdrop className="rf-success-portfolio-lock-backdrop" />
                    <OverviewLockedCardOverlay
                      stacked
                      title={pageCopy.portfolioLockedTitle}
                      subtitle={pageCopy.portfolioEmpty}
                      className="rf-success-portfolio-lock-overlay"
                    />
                  </>
                ) : null}
              </div>
            )}
          </SuccessCard>

          <SuccessCard title={pageCopy.recommendedAllocationTitle} icon={BarChart3}>
            <RecommendedAllocationBar slices={recommendedAllocation} />
          </SuccessCard>
        </div>

        <SuccessCard
          title={`${pageCopy.recommendedFundsTitle} (${data.funds.length})`}
          icon={Filter}
          className="rf-success-funds-panel"
        >
          <div className="rf-success-funds-toolbar">
            <div className="rf-success-filters" role="tablist" aria-label={pageCopy.filterLabel}>
              <button
                type="button"
                role="tab"
                aria-selected={activeFilter === FUNDS_FOR_YOU_FILTER_ALL}
                className={cn(
                  "rf-success-filter-chip",
                  activeFilter === FUNDS_FOR_YOU_FILTER_ALL && "rf-success-filter-chip-active",
                )}
                onClick={() => setActiveFilter(FUNDS_FOR_YOU_FILTER_ALL)}
              >
                {pageCopy.filterAll}
              </button>
              {filterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === option.id}
                  className={cn(
                    "rf-success-filter-chip",
                    activeFilter === option.id && "rf-success-filter-chip-active",
                  )}
                  onClick={() => setActiveFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Select
              value={sortMode}
              onValueChange={(value) => {
                if (value === "match" || value === "return_3y") setSortMode(value);
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label={pageCopy.sortBy}
                className="rf-success-sort-trigger h-8 border-white/14 bg-white/8 px-3 text-[0.68rem] font-medium text-white/90 shadow-none hover:bg-white/12 data-popup-open:border-white/25 data-popup-open:bg-white/10 dark:bg-white/8 dark:hover:bg-white/12"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="rf-success-sort-content min-w-[9.5rem]">
                <SelectItem value="match">{pageCopy.sortMatch}</SelectItem>
                <SelectItem value="return_3y">{pageCopy.sortReturns}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rf-success-fund-list">
            {filteredFunds.map((fund) => (
              <FundRow key={fund.product_id} fund={fund} />
            ))}
          </div>
        </SuccessCard>
      </div>
    </div>
  );
}
