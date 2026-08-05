"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { FieldMessage } from "@/components/ui/ui-message";
import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import {
  bulkUpsertMfCartItems,
  fetchInvestConfig,
  fetchInvestFunds,
  fetchInvestHome,
  fetchMfCart,
  type InvestCategory,
  type InvestConfig,
  type InvestFundSummary,
} from "@/features/invest/api/invest-api";
import { MfBreadcrumb } from "@/features/invest/components/mf-breadcrumb";
import { MfInvestPaymentCard } from "@/features/invest/components/mf-invest-payment-card";
import { MfFundsTable } from "@/features/invest/components/mf-funds-table";
import { buildBulkCartItems } from "@/features/invest/lib/mf-cart-amount";
import { collectionMetaFor } from "@/features/invest/lib/mf-collection-meta";
import { mfFundHref } from "@/features/invest/lib/mf-fund-url";
import { MF_ALL_FUNDS_PAGE_SIZE, mergeInvestFunds, resolveInvestFundsPageHasMore } from "@/features/invest/lib/mf-fund-ranking";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { useAuth } from "@/contexts/auth-context";
import { copy } from "@/shared/config/copy";

type MfCollectionPageProps = {
  slug: string;
};

export function MfCollectionPage({ slug }: MfCollectionPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [collection, setCollection] = useState<InvestCategory | null>(null);
  const [config, setConfig] = useState<InvestConfig | null>(null);
  const [funds, setFunds] = useState<InvestFundSummary[]>([]);
  const [selectedFund, setSelectedFund] = useState<InvestFundSummary | null>(null);
  const [investAmount, setInvestAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [buyAllSubmitting, setBuyAllSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadPageRef = useRef<(nextPage: number, append: boolean) => Promise<void>>(async () => {});
  const LOAD_MORE_ROOT_MARGIN_PX = 160;

  const tryScheduleLoadMore = useCallback(() => {
    if (!hasMoreRef.current || loadingMoreRef.current) return;

    const node = loadMoreRef.current;
    const root = scrollContainerRef.current;
    if (!node || !root) return;

    const rootRect = root.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    if (nodeRect.top <= rootRect.bottom + LOAD_MORE_ROOT_MARGIN_PX) {
      void loadPageRef.current(pageRef.current + 1, true);
    }
  }, []);

  const meta = useMemo(() => collectionMetaFor(slug), [slug]);
  const canInvest = Boolean(user?.fund_movement_eligible && config?.orders_enabled);

  useEffect(() => {
    let cancelled = false;
    fetchInvestConfig()
      .then((next) => {
        if (!cancelled) setConfig(next);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const loadPage = useCallback(async (nextPage: number, append: boolean) => {
    if (append) {
      if (loadingMoreRef.current || !hasMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else if (!hasLoadedOnceRef.current) {
      setInitialLoading(true);
    }
    setError(null);

    try {
      const response = await fetchInvestFunds({
        category: slug,
        page: nextPage,
        page_size: MF_ALL_FUNDS_PAGE_SIZE,
        sort: "rank",
      });

      let previousCount = 0;
      let mergedCount = 0;
      setFunds((current) => {
        previousCount = current.length;
        const merged = append ? mergeInvestFunds(current, response.items) : mergeInvestFunds([], response.items);
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

      if (!append && response.items.length > 0) {
        setSelectedFund(response.items[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.collectionLoadError);
    } finally {
      setInitialLoading(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
      queueMicrotask(() => {
        tryScheduleLoadMore();
      });
    }
  }, [slug, tryScheduleLoadMore]);

  useEffect(() => {
    loadPageRef.current = loadPage;
  }, [loadPage]);

  useEffect(() => {
    void loadPage(1, false);
  }, [loadPage]);

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
  }, [initialLoading, hasMore, tryScheduleLoadMore, slug]);

  const handleSelectFund = useCallback((fund: InvestFundSummary) => {
    setSelectedFund(fund);
  }, []);

  const handleOpenFund = useCallback(
    (fund: InvestFundSummary) => {
      router.push(mfFundHref(fund));
    },
    [router],
  );

  async function handleBuyAll() {
    if (!canInvest || funds.length === 0) return;

    setBuyAllSubmitting(true);
    setError(null);
    try {
      const cartMeta = await fetchMfCart();
      const items = buildBulkCartItems(funds, investAmount, cartMeta);
      if (items.length === 0) {
        setError(copy.mutualFunds.cartBuyAllEmpty);
        return;
      }

      const cart = await bulkUpsertMfCartItems({ items });
      toast.success(copy.mutualFunds.cartBuyAllSuccess.replace("{count}", String(items.length)), {
        action: {
          label: copy.mutualFunds.cartViewAction,
          onClick: () => router.push("/dashboard/mutual-funds/cart"),
        },
      });

      if (items.length < funds.length) {
        toast.message(
          copy.mutualFunds.cartBuyAllTruncated
            .replace("{added}", String(items.length))
            .replace("{total}", String(funds.length)),
        );
      }
      if (cart.item_count >= cart.max_items) {
        toast.message(copy.mutualFunds.cartFullHint);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.mutualFunds.cartBuyAllFailed);
    } finally {
      setBuyAllSubmitting(false);
    }
  }

  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MfBreadcrumb
        trail={[
          {
            label: collection?.name ?? copy.mutualFunds.collectionsTitle,
          },
        ]}
      />

      <FundEligibilityBanner />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <PageTitle>
            {collection?.name ?? copy.mutualFunds.loadingCollection}
          </PageTitle>
          <p className="max-w-2xl text-compact text-muted-foreground">{meta.description}</p>
        </div>
        {canInvest && funds.length > 0 ? (
          <Button
            variant="outline"
            className="shrink-0 gap-2"
            disabled={buyAllSubmitting}
            onClick={() => void handleBuyAll()}
          >
            {buyAllSubmitting ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
            {copy.mutualFunds.cartBuyAllCta}
          </Button>
        ) : null}
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
              <MfFundsTable
                funds={funds}
                totalCount={total}
                loadingMore={loadingMore}
                hasMore={hasMore}
                scrollContainerRef={scrollContainerRef}
                loadMoreRef={loadMoreRef}
                onRowClick={handleSelectFund}
                onRowDoubleClick={handleOpenFund}
                selectedProductId={selectedFund?.product_id}
              />
            )}
          </div>
        </div>

        <MfInvestPaymentCard
          fundName={selectedFund?.name}
          productId={selectedFund?.product_id}
          minLumpsumAmountInr={selectedFund?.min_lumpsum_amount_inr}
          minSipAmountInr={selectedFund?.min_sip_amount_inr}
          preview={!canInvest}
          canInvest={canInvest}
          sipEnabled={config?.sip_enabled ?? false}
          amount={investAmount}
          onAmountChange={setInvestAmount}
        />
      </div>
    </div>
  );
}
