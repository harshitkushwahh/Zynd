"use client";

import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import { fetchFamilyGroups } from "@/features/family-groups/api/family-groups-api";
import { fetchMyGoals } from "@/features/goals/api/goals-api";
import { fetchMfOrders, fetchMfSipPlans } from "@/features/invest/api/invest-api";
import { queryKeys } from "@/lib/query-keys";

const OVERVIEW_ORDERS_LIMIT = 100;

/**
 * Risk context boots with loading=false, then flips true in a mount effect.
 * Defer settling so we don't briefly treat "not started" as "ready".
 */
function useRiskProfileSettled() {
  const riskProfile = useRiskProfileOptional();
  const riskLoading = riskProfile?.loading ?? false;
  const [settled, setSettled] = useState(() => riskProfile == null);

  useEffect(() => {
    if (!riskProfile) {
      setSettled(true);
      return;
    }

    if (riskLoading) {
      setSettled(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled && !riskProfile.loading) {
        setSettled(true);
      }
    }, 32);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [riskProfile, riskLoading]);

  return settled && !riskLoading;
}

/** Warms shared query cache for overview cards; gates the overview skeleton only. */
export function useOverviewDashboardData() {
  const riskSettled = useRiskProfileSettled();

  const [groupsQuery, plansQuery, ordersQuery, goalsQuery] = useQueries({
    queries: [
      {
        queryKey: queryKeys.family.list(),
        queryFn: fetchFamilyGroups,
        select: (response) => response.items.filter((group) => group.status === "active").length,
      },
      {
        queryKey: queryKeys.invest.sipPlans(),
        queryFn: fetchMfSipPlans,
        select: (response) => response.plans.length,
      },
      {
        queryKey: queryKeys.invest.orders(OVERVIEW_ORDERS_LIMIT),
        queryFn: () => fetchMfOrders(OVERVIEW_ORDERS_LIMIT),
        select: (response) => response.orders.length,
      },
      {
        queryKey: queryKeys.goals.me(true),
        queryFn: () => fetchMyGoals(true),
        select: (response) =>
          response.items.filter((goal) => goal.status !== "archived").length,
      },
    ],
  });

  const queries = [groupsQuery, plansQuery, ordersQuery, goalsQuery];
  const hasCachedSnapshot = queries.some((query) => query.data !== undefined);
  const queriesSettled = queries.every((query) => query.isFetched);
  const ready = riskSettled && (hasCachedSnapshot || queriesSettled);

  return { ready };
}
