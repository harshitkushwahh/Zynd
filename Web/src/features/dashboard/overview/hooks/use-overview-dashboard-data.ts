"use client";

import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import {
  clearOverviewReadyLatch,
  readOverviewReadyLatch,
  setOverviewReadyLatch,
} from "@/features/dashboard/overview/lib/overview-ready-latch";
import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import { fetchFamilyGroups } from "@/features/family-groups/api/family-groups-api";
import { fetchMyGoals } from "@/features/goals/api/goals-api";
import { fetchMfOrders, fetchMfSipPlans } from "@/features/invest/api/invest-api";
import { queryKeys } from "@/lib/query-keys";

const OVERVIEW_ORDERS_LIMIT = 100;
const OVERVIEW_READY_TIMEOUT_MS = 4_000;

/**
 * Warms shared query cache for overview cards and gates the initial skeleton only.
 * Once ready, stays ready through HMR refetches to avoid remounting heavy widgets.
 */
export function useOverviewDashboardData() {
  const { user, loading: authLoading } = useAuth();
  const enabled = Boolean(user);
  const riskProfile = useRiskProfileOptional();
  const riskLoading = Boolean(enabled && riskProfile?.loading);

  const [groupsQuery, plansQuery, ordersQuery, goalsQuery] = useQueries({
    queries: [
      {
        queryKey: queryKeys.family.list(),
        queryFn: fetchFamilyGroups,
        enabled,
        select: (response: Awaited<ReturnType<typeof fetchFamilyGroups>>) =>
          response.items.filter((group) => group.status === "active").length,
      },
      {
        queryKey: queryKeys.invest.sipPlans(),
        queryFn: fetchMfSipPlans,
        enabled,
        select: (response: Awaited<ReturnType<typeof fetchMfSipPlans>>) => response.plans.length,
      },
      {
        queryKey: queryKeys.invest.orders(OVERVIEW_ORDERS_LIMIT),
        queryFn: () => fetchMfOrders(OVERVIEW_ORDERS_LIMIT),
        enabled,
        select: (response: Awaited<ReturnType<typeof fetchMfOrders>>) => response.orders.length,
      },
      {
        queryKey: queryKeys.goals.me(true),
        queryFn: () => fetchMyGoals(true),
        enabled,
        select: (response: Awaited<ReturnType<typeof fetchMyGoals>>) =>
          response.items.filter((goal) => goal.status !== "archived").length,
      },
    ],
  });

  const queries = [groupsQuery, plansQuery, ordersQuery, goalsQuery];
  const queriesSettled = !enabled || queries.every((query) => query.isFetched);
  const readyNow = !riskLoading && queriesSettled;

  const [ready, setReady] = useState(() => readOverviewReadyLatch());

  useEffect(() => {
    if (!enabled) {
      // Ignore brief user=null flicker during Fast Refresh; reset only after auth settles.
      if (!authLoading) {
        clearOverviewReadyLatch();
        setReady(false);
      }
      return;
    }

    if (readyNow) {
      setOverviewReadyLatch(true);
      setReady(true);
      return;
    }

    if (readOverviewReadyLatch()) {
      setReady(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setOverviewReadyLatch(true);
      setReady(true);
    }, OVERVIEW_READY_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [authLoading, enabled, readyNow]);

  return { ready };
}
