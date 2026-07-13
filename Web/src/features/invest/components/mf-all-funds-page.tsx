"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { FieldMessage } from "@/components/ui/ui-message";
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
import { MF_ALL_FUNDS_PAGE_SIZE, mergeInvestFunds } from "@/features/invest/lib/mf-fund-ranking";
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

  const filteredFunds = useMemo(() => applyMfFundFilters(funds, filters), [funds, filters]);
  const tablePaused = loadingMore || refetching;
  const tableTotalCount = hasClientOnlyMfFundFilters(filters) ? filteredFunds.length : total;

  const filterOptions = useMemo(
    () => collectFilterOptions(funds, categories),
    [categories, funds],
  );

  const categoryLabel = useMemo(() => {
    if (!filters.categorySlug) return null;
    return categories.find((category) => category.slug === filters.categorySlug)?.name ?? null;
  }, [categories, filters.categorySlug]);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean, categorySlug: string | null) => {
      if (nextPage === 1) {
        if (hasLoadedOnceRef.current) setRefetching(true);
        else setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const response = await fetchInvestFunds({
          category: categorySlug ?? undefined,
          page: nextPage,
          page_size: MF_ALL_FUNDS_PAGE_SIZE,
          sort: "rank",
        });

        setFunds((current) => (append ? mergeInvestFunds(current, response.items) : mergeInvestFunds([], response.items)));
        setPage(response.page);
        setHasMore(response.has_more);
        setTotal(response.total);
        hasLoadedOnceRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.mutualFunds.catalogLoadError);
      } finally {
        setInitialLoading(false);
        setRefetching(false);
        setLoadingMore(false);
      }
    },
    [],
  );

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
    if (!hasMore || initialLoading || refetching || loadingMore) return;

    const node = loadMoreRef.current;
    const root = scrollContainerRef.current;
    if (!node || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadPage(page + 1, true, filters.categorySlug);
        }
      },
      { root, rootMargin: "120px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [
    filters.categorySlug,
    hasMore,
    initialLoading,
    loadPage,
    loadingMore,
    page,
    refetching,
  ]);

  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MfBreadcrumb
        trail={[
          {
            label: categoryLabel ?? copy.mutualFunds.allFundsTitle,
          },
        ]}
      />

      <div className="mb-6">
        <h1 className="text-h4 font-semibold tracking-tight text-foreground">{copy.mutualFunds.allFundsTitle}</h1>
      </div>

      <MfFundsFilterBar
        filters={filters}
        categories={filterOptions.categories}
        amcs={filterOptions.amcs}
        onChange={setFilters}
      />

      <div className="relative mt-6">
        {error ? <FieldMessage variant="error" message={error} className="mb-4" /> : null}

        <div className="relative flex h-[min(32rem,calc(100vh-14rem))] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
          {initialLoading ? (
            <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" />
              {copy.mutualFunds.loadingFunds}
            </div>
          ) : (
            <>
              <MfFundsTable
                funds={filteredFunds}
                totalCount={tableTotalCount}
                loading={tablePaused}
                scrollContainerRef={scrollContainerRef}
                loadMoreRef={loadMoreRef}
              />

              {tablePaused ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-caption text-muted-foreground shadow-zynd-mid backdrop-blur-sm">
                    <Loader2 className="size-3.5 animate-spin" />
                    {copy.mutualFunds.loadingMore}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
