"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { FieldMessage } from "@/components/ui/ui-message";
import {
  fetchInvestFunds,
  fetchInvestHome,
  type InvestCategory,
  type InvestFundSummary,
} from "@/features/invest/api/invest-api";
import { MfBreadcrumb } from "@/features/invest/components/mf-breadcrumb";
import { MfInvestPaymentCard } from "@/features/invest/components/mf-invest-payment-card";
import { MfFundsTable } from "@/features/invest/components/mf-funds-table";
import { collectionMetaFor } from "@/features/invest/lib/mf-collection-meta";
import { MF_ALL_FUNDS_PAGE_SIZE, mergeInvestFunds } from "@/features/invest/lib/mf-fund-ranking";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";

type MfCollectionPageProps = {
  slug: string;
};

export function MfCollectionPage({ slug }: MfCollectionPageProps) {
  const router = useRouter();
  const [collection, setCollection] = useState<InvestCategory | null>(null);
  const [funds, setFunds] = useState<InvestFundSummary[]>([]);
  const [selectedFund, setSelectedFund] = useState<InvestFundSummary | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const meta = useMemo(() => collectionMetaFor(slug), [slug]);

  useEffect(() => {
    let cancelled = false;
    fetchInvestHome()
      .then((home) => {
        if (cancelled) return;
        const match =
          home.collections?.find((item) => item.slug === slug) ??
          null;
        setCollection(match);
        if (!match) {
          setError(copy.mutualFunds.collectionNotFound);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || copy.mutualFunds.collectionLoadError);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loadPage = useCallback(async (nextPage: number, append: boolean) => {
    if (nextPage === 1) {
      if (!hasLoadedOnceRef.current) setInitialLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await fetchInvestFunds({
        category: slug,
        page: nextPage,
        page_size: MF_ALL_FUNDS_PAGE_SIZE,
        sort: "rank",
      });

      setFunds((current) => (append ? mergeInvestFunds(current, response.items) : mergeInvestFunds([], response.items)));
      setPage(response.page);
      setHasMore(response.has_more);
      setTotal(response.total);
      hasLoadedOnceRef.current = true;

      if (!append && response.items.length > 0) {
        setSelectedFund(response.items[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.collectionLoadError);
    } finally {
      setInitialLoading(false);
      setLoadingMore(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadPage(1, false);
  }, [loadPage]);

  useEffect(() => {
    if (!hasMore || initialLoading || loadingMore) return;

    const node = loadMoreRef.current;
    const root = scrollContainerRef.current;
    if (!node || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadPage(page + 1, true);
        }
      },
      { root, rootMargin: "120px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, initialLoading, loadPage, loadingMore, page]);

  const handleSelectFund = useCallback((fund: InvestFundSummary) => {
    setSelectedFund(fund);
  }, []);

  const handleOpenFund = useCallback(
    (fund: InvestFundSummary) => {
      router.push(`/dashboard/mutual-funds/funds/${fund.product_id}`);
    },
    [router],
  );

  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MfBreadcrumb
        trail={[
          {
            label: collection?.name ?? copy.mutualFunds.collectionsTitle,
          },
        ]}
      />

      <div className="mb-6 space-y-2">
        <h1 className="text-h4 font-semibold tracking-tight text-foreground">
          {collection?.name ?? copy.mutualFunds.loadingCollection}
        </h1>
        <p className="max-w-2xl text-compact text-muted-foreground">{meta.description}</p>
      </div>

      {error ? <FieldMessage variant="error" message={error} className="mb-4" /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-w-0">
          <div className="relative flex h-[min(36rem,calc(100vh-12rem))] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
            {initialLoading ? (
              <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin" />
                {copy.mutualFunds.loadingFunds}
              </div>
            ) : funds.length === 0 && !error ? (
              <div className="flex h-full min-h-[280px] items-center justify-center px-6 text-center text-compact text-muted-foreground">
                {copy.mutualFunds.collectionEmpty}
              </div>
            ) : (
              <>
                <MfFundsTable
                  funds={funds}
                  totalCount={total}
                  loading={loadingMore}
                  scrollContainerRef={scrollContainerRef}
                  loadMoreRef={loadMoreRef}
                  onRowClick={handleSelectFund}
                  onRowDoubleClick={handleOpenFund}
                  selectedProductId={selectedFund?.product_id}
                />

                {loadingMore ? (
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

        <MfInvestPaymentCard fundName={selectedFund?.name} preview />
      </div>
    </div>
  );
}
