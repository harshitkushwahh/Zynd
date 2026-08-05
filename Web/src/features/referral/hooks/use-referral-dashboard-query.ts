"use client";

import { useQueries } from "@tanstack/react-query";

import {
  fetchReferralLeaderboard,
  fetchReferralList,
  fetchReferralMe,
} from "@/features/referral/api/referral-api";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

const LEADERBOARD_PERIOD = "this_month" as const;

export function useReferralDashboardQuery() {
  const [meQuery, listQuery, leaderboardQuery] = useQueries({
    queries: [
      {
        queryKey: queryKeys.referral.me(),
        queryFn: fetchReferralMe,
      },
      {
        queryKey: queryKeys.referral.list(),
        queryFn: fetchReferralList,
      },
      {
        queryKey: queryKeys.referral.leaderboard(LEADERBOARD_PERIOD),
        queryFn: () => fetchReferralLeaderboard(LEADERBOARD_PERIOD),
      },
    ],
  });

  const isPending = meQuery.isPending || listQuery.isPending || leaderboardQuery.isPending;
  const isFetching = meQuery.isFetching || listQuery.isFetching || leaderboardQuery.isFetching;
  const hasError = Boolean(meQuery.error || listQuery.error || leaderboardQuery.error);

  return {
    data: meQuery.data ?? null,
    referrals: listQuery.data?.items ?? [],
    leaderboard: leaderboardQuery.data ?? null,
    showSkeleton: isPending && !meQuery.data,
    error: hasError ? copy.referral.loadFailed : "",
    isFetching,
    isPending,
    refetch: async () => {
      await Promise.all([meQuery.refetch(), listQuery.refetch(), leaderboardQuery.refetch()]);
    },
  };
}
