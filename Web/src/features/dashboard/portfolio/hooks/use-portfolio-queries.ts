"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchPortfolioHoldings,
  fetchPortfolioHoldingDetail,
  fetchPortfolioRedeemUnits,
  fetchPortfolioSummary,
  fetchRedemptionJourney,
} from "@/features/dashboard/portfolio/lib/portfolio-api";
import {
  mapPortfolioGrowthToFlowSeries,
  mapPortfolioHoldingDetail,
  mapPortfolioHoldingToItem,
  mapPortfolioSummaryToPreview,
  portfolioHoldingHasDayChange,
  portfolioSummaryHasDayChange,
} from "@/features/dashboard/portfolio/lib/portfolio-mapper";
import {
  mapRedeemUnitsItemToRow,
  mapRedemptionJourneyToPortfolioView,
} from "@/features/dashboard/portfolio/lib/portfolio-redeem-mapper";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

export function usePortfolioSummaryQuery() {
  const query = useQuery({
    queryKey: queryKeys.portfolio.summary(),
    queryFn: fetchPortfolioSummary,
  });

  const summary = query.data;
  const preview = summary ? mapPortfolioSummaryToPreview(summary) : null;
  const flowSeries = summary ? mapPortfolioGrowthToFlowSeries(summary.growth) : [];
  const showDayChange = summary ? portfolioSummaryHasDayChange(summary) : false;

  const errorMessage =
    query.error instanceof Error
      ? query.error.message || copy.dashboard.overview.holdingsLoadError
      : query.error
        ? copy.dashboard.overview.holdingsLoadError
        : null;

  return {
    ...query,
    summary,
    preview,
    flowSeries,
    showDayChange,
    showSkeleton: query.isPending && !query.data && !query.error,
    errorMessage,
  };
}

export function usePortfolioHoldingsQuery() {
  const query = useQuery({
    queryKey: queryKeys.portfolio.holdings(),
    queryFn: fetchPortfolioHoldings,
  });

  const holdings = (query.data?.holdings ?? []).map(mapPortfolioHoldingToItem);
  const status = query.data?.status ?? null;
  const hasPendingOrders = query.data?.has_pending_orders ?? false;

  const errorMessage =
    query.error instanceof Error
      ? query.error.message || copy.dashboard.overview.holdingsLoadError
      : query.error
        ? copy.dashboard.overview.holdingsLoadError
        : null;

  return {
    ...query,
    holdings,
    status,
    hasPendingOrders,
    showSkeleton: query.isPending && !query.data && !query.error,
    errorMessage,
  };
}

export function usePortfolioHoldingDetailQuery(holdingId: string) {
  const query = useQuery({
    queryKey: queryKeys.portfolio.holdingDetail(holdingId),
    queryFn: () => fetchPortfolioHoldingDetail(holdingId),
    enabled: Boolean(holdingId),
  });

  const holding = query.data?.holding ? mapPortfolioHoldingDetail(query.data.holding) : null;
  const showDayChange = query.data?.holding ? portfolioHoldingHasDayChange(query.data.holding) : false;

  const errorMessage =
    query.error instanceof Error
      ? query.error.message || copy.dashboard.portfolio.holdingDetailLoadFailed
      : query.error
        ? copy.dashboard.portfolio.holdingDetailLoadFailed
        : null;

  return {
    ...query,
    holding,
    status: query.data?.status ?? null,
    showDayChange,
    showSkeleton: query.isPending && !query.data && !query.error,
    errorMessage,
  };
}

export function usePortfolioRedeemUnitsQuery() {
  const query = useQuery({
    queryKey: queryKeys.portfolio.redeemUnits(),
    queryFn: fetchPortfolioRedeemUnits,
  });

  const rows = (query.data?.items ?? []).map(mapRedeemUnitsItemToRow);
  const errorMessage =
    query.error instanceof Error
      ? query.error.message || copy.dashboard.overview.holdingsLoadError
      : query.error
        ? copy.dashboard.overview.holdingsLoadError
        : null;

  return {
    ...query,
    rows,
    status: query.data?.status ?? null,
    showSkeleton: query.isPending && !query.data && !query.error,
    errorMessage,
  };
}

export function useRedemptionJourneyQuery(fpRedemptionId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.portfolio.redemptionJourney(fpRedemptionId ?? ""),
    queryFn: () => fetchRedemptionJourney(fpRedemptionId!),
    enabled: Boolean(fpRedemptionId),
  });

  const journey = query.data?.journey ? mapRedemptionJourneyToPortfolioView(query.data.journey) : null;
  const fetchStatus = query.data?.status ?? null;
  const errorMessage =
    query.error instanceof Error
      ? query.error.message || copy.dashboard.portfolio.redeemJourneyLoadFailed
      : query.error
        ? copy.dashboard.portfolio.redeemJourneyLoadFailed
        : null;

  return {
    ...query,
    journey,
    fetchStatus,
    showSkeleton: query.isPending && Boolean(fpRedemptionId) && !query.data && !query.error,
    errorMessage,
  };
}
