"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { PageTitle } from "@/components/ui/page-title";
import { FieldMessage } from "@/components/ui/ui-message";
import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import {
  fetchInvestFunds,
  fetchInvestHome,
  type InvestCategory,
  type InvestFundSummary,
} from "@/features/invest/api/invest-api";
import { MfBreadcrumb } from "@/features/invest/components/mf-breadcrumb";
import { MfFundsFilterBar } from "@/features/invest/components/mf-funds-filter-bar";
import { MfFundsTable } from "@/features/invest/components/mf-funds-table";
import {
  EMPTY_MF_FUND_FILTERS,
  applyMfFundFilters,
  collectFilterOptions,
  hasClientOnlyMfFundFilters,
  type MfFundFilters,
} from "@/features/invest/lib/mf-fund-filters";
import { MF_ALL_FUNDS_PAGE_SIZE, mergeInvestFunds, resolveInvestFundsPageHasMore } from "@/features/invest/lib/mf-fund-ranking";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";

type MfAllFundsPageProps = {
  initialCategorySlug?: string | null;
};

export function MfAllFundsPage({ initialCategorySlug = null }: MfAllFundsPageProps) {
  const [categories, setCategories] = useState<InvestCategory[]>([]);
  const [filters, setFilters] = useState<MfFundFilters>({
    ...EMPTY_MF_FUND_FILTERS,
    categorySlug: initialCategorySlug,
  });
  const [funds, setFunds] = useState<InvestFundSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const refetchingRef = useRef(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const categorySlugRef = useRef<string | null>(initialCategorySlug);
  const loadPageRef = useRef<
    (nextPage: number, append: boolean, categorySlug: string | null) => Promise<void>
  >(async () => {});
  const LOAD_MORE_ROOT_MARGIN_PX = 160;

  const tryScheduleLoadMore = useCallback(() => {
    if (!hasMoreRef.current || loadingMoreRef.current || refetchingRef.current) return;

    const node = loadMoreRef.current;
    const root = scrollContainerRef.current;
    if (!node || !root) return;

    const rootRect = root.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    if (nodeRect.top <= rootRect.bottom + LOAD_MORE_ROOT_MARGIN_PX) {
      void loadPageRef.current(pageRef.current + 1, true, categorySlugRef.current);
    }
  }, []);

  const filteredFunds = useMemo(() => applyMfFundFilters(funds, filters), [funds, filters]);
  const tableTotalCount = hasClientOnlyMfFundFilters(filters) ? filteredFunds.length : total;

  const filterOptions = useMemo(
    () => collectFilterOptions(funds, categories),
    [categories, funds],
  );

  const categoryLabel = useMemo(() => {
    if (!filters.categorySlug) return null;
    return categories.find((category) => category.slug === filters.categorySlug)?.name ?? null;
  }, [categories, filters.categorySlug]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    categorySlugRef.current = filters.categorySlug;
  }, [filters.categorySlug]);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean, categorySlug: string | null) => {
      if (append) {
        if (loadingMoreRef.current || !hasMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else if (nextPage === 1) {
        pageRef.current = 1;
        if (hasLoadedOnceRef.current) {
          refetchingRef.current = true;
          setRefetching(true);
        } else {
          setInitialLoading(true);
        }
      }
      setError(null);

      try {
        const response = await fetchInvestFunds({
          category: categorySlug ?? undefined,
          page: nextPage,
          page_size: MF_ALL_FUNDS_PAGE_SIZE,
          sort: "rank",
        });

        let previousCount = 0;
        let mergedCount = 0;
        setFunds((current) => {
          previousCount = current.length;
          const merged = append
            ? mergeInvestFunds(current, response.items)
            : mergeInvestFunds([], response.items);
          mergedCount = merged.length;
          return merged;
        });

        const nextHasMore = resolveInvestFundsPageHasMore(
          append,
          previousCount,
          mergedCount,
          response.has_more,
          response.items.length,
        );
        pageRef.current = response.page;
        hasMoreRef.current = nextHasMore;
        setPage(response.page);
        setHasMore(nextHasMore);
        setTotal(response.total);
        hasLoadedOnceRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.mutualFunds.catalogLoadError);
      } finally {
        setInitialLoading(false);
        refetchingRef.current = false;
        setRefetching(false);
        loadingMoreRef.current = false;
        setLoadingMore(false);
        queueMicrotask(() => {
          tryScheduleLoadMore();
        });
      }
    },
    [tryScheduleLoadMore],
  );

  useEffect(() => {
    loadPageRef.current = loadPage;
  }, [loadPage]);

  useEffect(() => {
    let cancelled = false;
    fetchInvestHome()
      .then((home) => {
        if (!cancelled) setCategories(home.categories);
      })
      .catch(() => {
        // Categories are optional for rendering the table.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadPage(1, false, filters.categorySlug);
  }, [filters.categorySlug, loadPage]);

  useEffect(() => {
    if (initialLoading || !hasMore) return;

    const node = loadMoreRef.current;
    const root = scrollContainerRef.current;
    if (!node || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        tryScheduleLoadMore();
      },
      { root, rootMargin: `${LOAD_MORE_ROOT_MARGIN_PX}px`, threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [initialLoading, hasMore, tryScheduleLoadMore, filters.categorySlug]);

  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MfBreadcrumb
        trail={[
          {
            label: categoryLabel ?? copy.mutualFunds.allFundsTitle,
          },
        ]}
      />

      <FundEligibilityBanner />

      <div className="mb-6">
        <PageTitle>{copy.mutualFunds.allFundsTitle}</PageTitle>
      </div>

      <MfFundsFilterBar
        filters={filters}
        categories={filterOptions.categories}
        amcs={filterOptions.amcs}
        onChange={setFilters}
      />

      {error ? <FieldMessage variant="error" message={error} className="mt-4" /> : null}

      <div className="relative mt-6 min-w-0">
        <div className="relative flex h-[min(32rem,calc(100vh-14rem))] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          {initialLoading ? (
            <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" />
              {copy.mutualFunds.loadingFunds}
            </div>
          ) : (
            <MfFundsTable
              funds={filteredFunds}
              totalCount={tableTotalCount}
              refetching={refetching}
              loadingMore={loadingMore}
              hasMore={hasMore}
              scrollContainerRef={scrollContainerRef}
              loadMoreRef={loadMoreRef}
              emptyDescription={
                hasClientOnlyMfFundFilters(filters) && funds.length > 0
                  ? copy.mutualFunds.allFundsEmptyFiltered
                  : copy.mutualFunds.allFundsEmptyDescription
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
