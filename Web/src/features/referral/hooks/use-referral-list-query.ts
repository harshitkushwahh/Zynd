"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchReferralLeaderboard,
  fetchReferralList,
  type ReferralLeaderboardPeriod,
} from "@/features/referral/api/referral-api";
import { keepPreviousQueryData } from "@/lib/query-utils";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

export function useReferralListQuery() {
  const query = useQuery({
    queryKey: queryKeys.referral.list(),
    queryFn: fetchReferralList,
    staleTime: 30_000,
    placeholderData: keepPreviousQueryData,
  });

  return {
    ...query,
    referrals: query.data?.items ?? [],
    showSkeleton: query.isPending && !query.data,
    errorMessage: query.error ? copy.referral.loadFailed : "",
  };
}

export function useReferralLeaderboardQuery(period: ReferralLeaderboardPeriod) {
  const query = useQuery({
    queryKey: queryKeys.referral.leaderboard(period),
    queryFn: () => fetchReferralLeaderboard(period),
    placeholderData: keepPreviousQueryData,
  });

  return {
    ...query,
    leaderboard: query.data ?? null,
    showSkeleton: query.isPending && !query.data,
    isShowingPreviousData: query.isPlaceholderData,
    errorMessage: query.error ? copy.referral.loadFailed : "",
  };
}
