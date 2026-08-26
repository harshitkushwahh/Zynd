"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PortfolioTabEmptyState } from "@/features/dashboard/portfolio/components/portfolio-tab-empty-state";
import { getPortfolioTabMeta } from "@/features/dashboard/portfolio/lib/portfolio-page-tab-meta";
import { type MfSipPlan } from "@/features/invest/api/invest-api";
import { MfMySipsFilterBar } from "@/features/invest/components/mf-my-sips-filter-bar";
import { MfMySipsPageSkeleton } from "@/features/invest/components/mf-my-sips-page-skeleton";
import { MfMySipsTable } from "@/features/invest/components/mf-my-sips-table";
import { MfSipPlanDetailDialog } from "@/features/invest/components/mf-sip-plan-detail-dialog";
import { useMfSipPlansQuery } from "@/features/invest/hooks/use-mf-sip-plans-query";
import { invalidateInvestQueries } from "@/features/invest/lib/invalidate-invest-queries";
import {
  EMPTY_MF_SIP_FILTERS,
  applyMfSipFilters,
  sortMfSipPlans,
  type MfSipFilters,
} from "@/features/invest/lib/mf-sip-filters";
import { MF_TRANSACTIONS_TABLE_FRAME_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const SIPS_PAGE_SIZE = 25;

export function PortfolioSipsPanel() {
  const queryClient = useQueryClient();
  const { plans, showSkeleton, hasResolved, errorMessage, isPending, isFetching, refetch } = useMfSipPlansQuery();
  const [filters, setFilters] = useState<MfSipFilters>(EMPTY_MF_SIP_FILTERS);
  const [visibleCount, setVisibleCount] = useState(SIPS_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  const sortedPlans = useMemo(() => sortMfSipPlans(plans), [plans]);
  const filteredPlans = useMemo(
    () => applyMfSipFilters(sortedPlans, filters),
    [sortedPlans, filters],
  );
  const visiblePlans = useMemo(
    () => filteredPlans.slice(0, visibleCount),
    [filteredPlans, visibleCount],
  );
  const hasMore = visibleCount < filteredPlans.length;

  useEffect(() => {
    setVisibleCount(SIPS_PAGE_SIZE);
  }, [filters]);

  useEffect(() => {
    if ((isPending && plans.length === 0) || !hasMore) return;

    const node = loadMoreRef.current;
    const root = scrollContainerRef.current;
    if (!node || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (loadingMoreRef.current) return;

        loadingMoreRef.current = true;
        setLoadingMore(true);
        window.setTimeout(() => {
          setVisibleCount((current) => current + SIPS_PAGE_SIZE);
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }, 150);
      },
      { root, rootMargin: "120px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isPending, plans.length, hasMore]);

  useEffect(() => {
    if (detailOpen) return;

    const timer = window.setTimeout(() => {
      setSelectedPlanId(null);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [detailOpen]);

  const showTable = hasResolved && !errorMessage && filteredPlans.length > 0;
  const showEmpty = hasResolved && !errorMessage && plans.length === 0;
  const showFilteredEmpty =
    hasResolved && !errorMessage && plans.length > 0 && filteredPlans.length === 0;
  const sipsTabMeta = getPortfolioTabMeta("sips");

  return (
    <>
      {!hasResolved && showSkeleton ? <MfMySipsPageSkeleton /> : null}

      {hasResolved ? (
        <DashboardContentFade>
          {errorMessage ? (
            <LoadErrorCard
              title={copy.mySips.loadFailedTitle}
              description={errorMessage}
              retryLabel={copy.dashboard.portfolio.retry}
              retryLoading={isFetching}
              onRetry={() => void refetch()}
            />
          ) : null}

          {!errorMessage && showEmpty ? (
            <PortfolioTabEmptyState
              icon={sipsTabMeta.icon}
              title={copy.mySips.empty}
              description={copy.mySips.description}
            />
          ) : null}

          {!errorMessage && showFilteredEmpty ? (
            <>
              <MfMySipsFilterBar filters={filters} onChange={setFilters} />
              <div className="mt-6">
                <PortfolioTabEmptyState
                  icon={sipsTabMeta.icon}
                  title={copy.mySips.emptyFiltered}
                  description={copy.mySips.description}
                />
              </div>
            </>
          ) : null}

          {!errorMessage && showTable ? (
            <>
              <MfMySipsFilterBar filters={filters} onChange={setFilters} />

              <div className="relative mt-6 min-w-0">
                <div
                  className={cn(
                    "relative rounded-[var(--radius-card)] border border-border bg-card",
                    MF_TRANSACTIONS_TABLE_FRAME_CLASS,
                  )}
                >
                  <MfMySipsTable
                    plans={visiblePlans}
                    totalCount={filteredPlans.length}
                    loadingMore={loadingMore}
                    hasMore={hasMore}
                    ariaLabel={copy.mySips.title}
                    scrollContainerRef={scrollContainerRef}
                    loadMoreRef={loadMoreRef}
                    onPlanClick={(plan: MfSipPlan) => {
                      setSelectedPlanId(plan.plan_id);
                      setDetailOpen(true);
                    }}
                  />
                </div>
              </div>
            </>
          ) : null}
        </DashboardContentFade>
      ) : null}

      {detailOpen && selectedPlanId ? (
        <MfSipPlanDetailDialog
          open={detailOpen}
          planId={selectedPlanId}
          onOpenChange={setDetailOpen}
          onPlanUpdated={() => void invalidateInvestQueries(queryClient)}
        />
      ) : null}
    </>
  );
}
