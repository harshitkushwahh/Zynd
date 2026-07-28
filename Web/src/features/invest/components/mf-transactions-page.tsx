"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { PageTitle } from "@/components/ui/page-title";
import { FieldMessage } from "@/components/ui/ui-message";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
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
import { MF_PAGE_SECTION_CLASS, MF_TRANSACTIONS_TABLE_FRAME_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const TRANSACTIONS_PAGE_SIZE = 25;

const transactionsRoute = DASHBOARD_ROUTES.find((route) => route.id === "transactions")!;
const TransactionsIcon = transactionsRoute.icon;

function TransactionsBreadcrumb() {
  return <DashboardBreadcrumb items={[{ label: copy.transactions.title }]} />;
}

export function MfTransactionsPage() {
  const { orders, showSkeleton, errorMessage, isPending } = useMfOrdersQuery();
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

  const handleFiltersChange = (nextFilters: MfTransactionFilters) => {
    setFilters(nextFilters);
  };

  const handleOrderClick = (order: MfOrder) => {
    setSelectedOrderId(order.order_id);
    setJourneyOpen(true);
  };

  useEffect(() => {
    if (journeyOpen) return;

    const timer = window.setTimeout(() => {
      setSelectedOrderId(null);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [journeyOpen]);

  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <TransactionsBreadcrumb />

      <div className="mb-6 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
          <TransactionsIcon className="size-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <PageTitle>{copy.transactions.title}</PageTitle>
          <p className="mt-2 text-compact text-muted-foreground">{copy.transactions.description}</p>
        </div>
      </div>

      {errorMessage ? <FieldMessage variant="error" message={errorMessage} className="mb-4" /> : null}

      {showSkeleton ? <MfTransactionsPageSkeleton /> : null}

      {!showSkeleton && !errorMessage && orders.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border px-6 text-center">
          <p className="text-compact text-muted-foreground">{copy.transactions.empty}</p>
        </div>
      ) : null}

      {!showSkeleton && !errorMessage && orders.length > 0 ? (
        <>
          <MfTransactionsFilterBar filters={filters} onChange={handleFiltersChange} />

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
                onOrderClick={handleOrderClick}
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

    </div>
  );
}
