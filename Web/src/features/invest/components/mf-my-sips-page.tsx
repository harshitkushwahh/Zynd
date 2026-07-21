"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageTitle } from "@/components/ui/page-title";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { fetchMfSipPlans, type MfSipPlan } from "@/features/invest/api/invest-api";
import { MfMySipsFilterBar } from "@/features/invest/components/mf-my-sips-filter-bar";
import { MfMySipsPageSkeleton } from "@/features/invest/components/mf-my-sips-page-skeleton";
import { MfMySipsTable } from "@/features/invest/components/mf-my-sips-table";
import { MfSipPlanDetailDialog } from "@/features/invest/components/mf-sip-plan-detail-dialog";
import {
  EMPTY_MF_SIP_FILTERS,
  applyMfSipFilters,
  sortMfSipPlans,
  type MfSipFilters,
} from "@/features/invest/lib/mf-sip-filters";
import { MF_PAGE_SECTION_CLASS, MF_TRANSACTIONS_TABLE_FRAME_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const SIPS_PAGE_SIZE = 25;

const mySipsRoute = DASHBOARD_ROUTES.find((route) => route.id === "my-sips")!;
const MySipsIcon = mySipsRoute.icon;

function MySipsBreadcrumb() {
  return <DashboardBreadcrumb items={[{ label: copy.mySips.title }]} />;
}

export function MfMySipsPage() {
  const [plans, setPlans] = useState<MfSipPlan[]>([]);
  const [filters, setFilters] = useState<MfSipFilters>(EMPTY_MF_SIP_FILTERS);
  const [visibleCount, setVisibleCount] = useState(SIPS_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const loadInFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const loadPlans = useCallback(async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    if (showLoading) {
      setLoading(true);
    }

    try {
      const response = await fetchMfSipPlans();
      if (!mountedRef.current) return;
      setPlans(response.plans);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message.trim() : "";
      setError(message && message !== "Request failed" ? message : copy.mySips.loadError);
    } finally {
      loadInFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadPlans();

    return () => {
      mountedRef.current = false;
    };
  }, [loadPlans]);

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
    if (loading || !hasMore) return;

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
  }, [loading, hasMore]);

  const handlePlanClick = (plan: MfSipPlan) => {
    setSelectedPlanId(plan.plan_id);
    setDetailOpen(true);
  };

  const handlePlanUpdated = () => {
    void loadPlans();
  };

  const handleRetry = () => {
    void loadPlans({ showLoading: true });
  };

  useEffect(() => {
    if (detailOpen) return;

    const timer = window.setTimeout(() => {
      setSelectedPlanId(null);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [detailOpen]);

  const showTable = !loading && !error && plans.length > 0;
  const showEmpty = !loading && !error && plans.length === 0;

  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MySipsBreadcrumb />

      <div className="mb-6 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
          <MySipsIcon className="size-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <PageTitle>{copy.mySips.title}</PageTitle>
          <p className="mt-2 text-compact text-muted-foreground">{copy.mySips.description}</p>
        </div>
      </div>

      {loading && plans.length === 0 ? <MfMySipsPageSkeleton /> : null}

      {!loading && error ? (
        <LoadErrorCard
          title={copy.mySips.loadFailedTitle}
          description={error}
          retryLabel={copy.mySips.retry}
          retryLoading={loading}
          onRetry={handleRetry}
        />
      ) : null}

      {showEmpty ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border px-6 text-center">
          <p className="text-compact text-muted-foreground">{copy.mySips.empty}</p>
        </div>
      ) : null}

      {showTable ? (
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
                onPlanClick={handlePlanClick}
              />
            </div>
          </div>
        </>
      ) : null}

      {detailOpen && selectedPlanId ? (
        <MfSipPlanDetailDialog
          open={detailOpen}
          planId={selectedPlanId}
          onOpenChange={setDetailOpen}
          onPlanUpdated={handlePlanUpdated}
        />
      ) : null}
    </div>
  );
}
