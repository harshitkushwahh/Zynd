"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PortfolioTabEmptyState } from "@/features/dashboard/portfolio/components/portfolio-tab-empty-state";
import { getPortfolioTabMeta } from "@/features/dashboard/portfolio/lib/portfolio-page-tab-meta";
import { type MfOrder } from "@/features/invest/api/invest-api";
import { MfTransactionsFilterBar } from "@/features/invest/components/mf-transactions-filter-bar";
import { MfTransactionsPageSkeleton } from "@/features/invest/components/mf-transactions-page-skeleton";
import { MfTransactionsTable } from "@/features/invest/components/mf-transactions-table";
import { MfOrderJourneyDialog } from "@/features/invest/components/payment-dialog";
import { useMfOrdersQuery } from "@/features/invest/hooks/use-mf-orders-query";
import {
  EMPTY_MF_TRANSACTION_FILTERS,
  applyMfTransactionFilters,
  sortMfTransactions,
  type MfTransactionFilters,
} from "@/features/invest/lib/mf-transaction-filters";
import { MF_TRANSACTIONS_TABLE_FRAME_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const TRANSACTIONS_PAGE_SIZE = 25;

export function PortfolioTransactionsPanel() {
  const { orders, showSkeleton, errorMessage, isPending, isFetching, refetch } = useMfOrdersQuery();
  const [filters, setFilters] = useState<MfTransactionFilters>(EMPTY_MF_TRANSACTION_FILTERS);
  const [visibleCount, setVisibleCount] = useState(TRANSACTIONS_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  const sortedOrders = useMemo(() => sortMfTransactions(orders), [orders]);
  const filteredOrders = useMemo(
    () => applyMfTransactionFilters(sortedOrders, filters),
    [sortedOrders, filters],
  );
  const visibleOrders = useMemo(
    () => filteredOrders.slice(0, visibleCount),
    [filteredOrders, visibleCount],
  );
  const hasMore = visibleCount < filteredOrders.length;

  useEffect(() => {
    setVisibleCount(TRANSACTIONS_PAGE_SIZE);
  }, [filters]);

  useEffect(() => {
    if (isPending && orders.length === 0) return;

    const node = loadMoreRef.current;
    const root = scrollContainerRef.current;
    if (!node || !root || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (loadingMoreRef.current) return;

        loadingMoreRef.current = true;
        setLoadingMore(true);
        window.setTimeout(() => {
          setVisibleCount((current) => current + TRANSACTIONS_PAGE_SIZE);
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }, 150);
      },
      { root, rootMargin: "120px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isPending, orders.length, hasMore, filteredOrders.length]);

  useEffect(() => {
    if (journeyOpen) return;

    const timer = window.setTimeout(() => {
      setSelectedOrderId(null);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [journeyOpen]);

  const transactionsTabMeta = getPortfolioTabMeta("transactions");
  const showEmpty = !showSkeleton && !errorMessage && orders.length === 0;
  const showFilteredEmpty =
    !showSkeleton && !errorMessage && orders.length > 0 && filteredOrders.length === 0;
  const showTable = !showSkeleton && !errorMessage && filteredOrders.length > 0;

  return (
    <>
      {showSkeleton ? <MfTransactionsPageSkeleton /> : null}

      {!showSkeleton && errorMessage ? (
        <LoadErrorCard
          title={copy.transactions.loadFailedTitle}
          description={errorMessage}
          retryLabel={copy.transactions.retry}
          retryLoading={isFetching}
          onRetry={() => void refetch()}
        />
      ) : null}

      {showEmpty ? (
        <PortfolioTabEmptyState
          icon={transactionsTabMeta.icon}
          title={copy.transactions.empty}
          description={copy.transactions.description}
        />
      ) : null}

      {showFilteredEmpty ? (
        <>
          <MfTransactionsFilterBar filters={filters} onChange={setFilters} />
          <div className="mt-6">
            <PortfolioTabEmptyState
              icon={transactionsTabMeta.icon}
              title={copy.transactions.emptyFiltered}
              description={copy.transactions.description}
            />
          </div>
        </>
      ) : null}

      {showTable ? (
        <>
          <MfTransactionsFilterBar filters={filters} onChange={setFilters} />

          <div className="relative mt-6 min-w-0">
            <div
              className={cn(
                "relative rounded-[var(--radius-card)] border border-border bg-card",
                MF_TRANSACTIONS_TABLE_FRAME_CLASS,
              )}
            >
              <MfTransactionsTable
                orders={visibleOrders}
                totalCount={filteredOrders.length}
                loadingMore={loadingMore}
                hasMore={hasMore}
                ariaLabel={copy.transactions.title}
                scrollContainerRef={scrollContainerRef}
                loadMoreRef={loadMoreRef}
                onOrderClick={(order: MfOrder) => {
                  setSelectedOrderId(order.order_id);
                  setJourneyOpen(true);
                }}
              />
            </div>
          </div>
        </>
      ) : null}

      <MfOrderJourneyDialog
        open={journeyOpen}
        orderId={selectedOrderId}
        onOpenChange={setJourneyOpen}
      />
    </>
  );
}
