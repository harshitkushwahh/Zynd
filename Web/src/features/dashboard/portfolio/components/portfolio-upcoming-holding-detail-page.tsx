"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { LineChart } from "lucide-react";

import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { Skeleton } from "@/components/ui/skeleton";
import { PortfolioDetailLockedSection } from "@/features/dashboard/portfolio/components/portfolio-detail-locked-section";
import { PortfolioUpcomingOrderSummaryCard } from "@/features/dashboard/portfolio/components/portfolio-upcoming-order-summary-card";
import { resolveUpcomingHoldingOrder } from "@/features/dashboard/portfolio/lib/portfolio-holding-detail-data";
import { MfOrderJourneyDialog } from "@/features/invest/components/payment-dialog";
import { useMfOrderQuery } from "@/features/invest/hooks/use-mf-order-query";
import { useMfOrdersQuery } from "@/features/invest/hooks/use-mf-orders-query";
import { isUpcomingHoldingOrder } from "@/features/invest/lib/mf-transaction-filters";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type PortfolioUpcomingHoldingDetailPageProps = {
  slug: string;
};

function UpcomingHoldingDetailPlaceholder() {
  return (
    <section
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-5 h-28 w-full rounded-[var(--radius-control)] sm:h-32" />
    </section>
  );
}

function PortfolioUpcomingHoldingDetailBreadcrumbSkeleton({
  fundLabelWidthClass = "w-48",
}: {
  fundLabelWidthClass?: string;
}) {
  return (
    <div className="mb-6 flex min-w-0 items-center gap-2">
      <Skeleton className="h-4 w-16 shrink-0" />
      <Skeleton className="size-3.5 shrink-0 rounded-full" />
      <Skeleton className={cn("h-4 max-w-full", fundLabelWidthClass)} />
    </div>
  );
}

function PortfolioUpcomingOrderSummarySkeleton() {
  return (
    <section
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="size-12 shrink-0 rounded-[var(--radius-control)]" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-full max-w-[18rem]" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[1.15rem] border border-border/60 bg-muted/20 p-3.5"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-5 w-24" />
          </div>
        ))}
      </div>
    </section>
  );
}

function PortfolioUpcomingHoldingDetailSkeleton({
  fundName,
}: {
  fundName?: string | null;
}) {
  const portfolioCopy = copy.dashboard.portfolio;

  return (
    <div className={cn(MF_PAGE_SECTION_CLASS, "pb-8")} aria-busy="true">
      {fundName ? (
        <DashboardBreadcrumb
          items={[
            { label: portfolioCopy.pageTitle, href: "/dashboard/portfolio" },
            { label: fundName },
          ]}
        />
      ) : (
        <PortfolioUpcomingHoldingDetailBreadcrumbSkeleton />
      )}

      <div className="space-y-4">
        <PortfolioUpcomingOrderSummarySkeleton />

        <PortfolioDetailLockedSection
          title={portfolioCopy.holdingUpcomingDetailLockedTitle}
          subtitle={portfolioCopy.holdingUpcomingDetailLockedDescription}
        >
          <UpcomingHoldingDetailPlaceholder />
        </PortfolioDetailLockedSection>
      </div>

      <span className="sr-only">{portfolioCopy.holdingDetailLoading}</span>
    </div>
  );
}

export function PortfolioUpcomingHoldingDetailPage({ slug }: PortfolioUpcomingHoldingDetailPageProps) {
  const portfolioCopy = copy.dashboard.portfolio;
  const { orders, hasResolved: ordersResolved } = useMfOrdersQuery(100);
  const resolvedOrder = resolveUpcomingHoldingOrder(orders, slug);
  const orderId = resolvedOrder?.order_id ?? "";
  const { order, showSkeleton: orderLoading, errorMessage, refetch, isFetching } = useMfOrderQuery(
    orderId,
    Boolean(orderId),
  );
  const [journeyOpen, setJourneyOpen] = useState(false);

  if (!ordersResolved || (orderId && orderLoading)) {
    return (
      <PortfolioUpcomingHoldingDetailSkeleton
        fundName={resolvedOrder?.product_name ?? null}
      />
    );
  }

  if (!resolvedOrder) {
    notFound();
  }

  if (errorMessage) {
    return (
      <div className={cn(MF_PAGE_SECTION_CLASS, "pb-8")}>
        <LoadErrorCard
          icon={LineChart}
          title={portfolioCopy.holdingDetailLoadFailed}
          description={errorMessage}
          retryLabel={portfolioCopy.retry}
          retryLoading={isFetching}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!order) {
    notFound();
  }
  if (!isUpcomingHoldingOrder(order)) {
    notFound();
  }

  const fundName = order.product_name ?? copy.mutualFunds.unknownFund;

  return (
    <DashboardContentFade className={cn(MF_PAGE_SECTION_CLASS, "pb-8")}>
      <DashboardBreadcrumb
        items={[
          { label: portfolioCopy.pageTitle, href: "/dashboard/portfolio" },
          { label: fundName },
        ]}
      />

      <div className="space-y-4">
        <PortfolioUpcomingOrderSummaryCard
          order={order}
          onViewJourney={() => setJourneyOpen(true)}
        />

        <PortfolioDetailLockedSection
          title={portfolioCopy.holdingUpcomingDetailLockedTitle}
          subtitle={portfolioCopy.holdingUpcomingDetailLockedDescription}
        >
          <UpcomingHoldingDetailPlaceholder />
        </PortfolioDetailLockedSection>
      </div>

      <MfOrderJourneyDialog open={journeyOpen} orderId={order.order_id} onOpenChange={setJourneyOpen} />
    </DashboardContentFade>
  );
}
