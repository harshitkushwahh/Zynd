"use client";

import { useLayoutEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { resolveFamilyGroupFromRef } from "@/features/family-groups/lib/family-group-slug";
import { useFamilyGroupQuery } from "@/features/family-groups/hooks/use-family-group-query";
import { useFamilyGroupsQuery } from "@/features/family-groups/hooks/use-family-groups-query";
import { usePortfolioHoldingDetailQuery } from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { useGoalDetailQuery } from "@/features/goals/hooks/use-goal-detail-query";
import { fetchInvestHome } from "@/features/invest/api/invest-api";
import { useMfCartNavbarMeta } from "@/features/invest/hooks/use-mf-cart-navbar-meta";
import { useMfFundNavbarMeta } from "@/features/invest/hooks/use-mf-fund-navbar-meta";
import {
  applyDocumentTitle,
  extractGoalDetailId,
  extractMfCollectionSlug,
  extractPortfolioHoldingId,
  resolveDocumentTitleLabel,
} from "@/lib/document-title";
import { queryKeys } from "@/lib/query-keys";
import { keepPreviousQueryData } from "@/lib/query-utils";
import { copy } from "@/shared/config/copy";

function useFamilyGroupDocumentTitle(pathname: string, groupRef: string | null) {
  const needsGroup =
    Boolean(groupRef) &&
    (pathname === "/dashboard/family/group" || pathname.startsWith("/dashboard/family/activity"));
  const { data: groupsData } = useFamilyGroupsQuery();
  const resolvedGroup = useMemo(
    () =>
      needsGroup && groupRef
        ? resolveFamilyGroupFromRef(groupsData?.items ?? [], groupRef)
        : null,
    [groupRef, groupsData?.items, needsGroup],
  );
  const { group } = useFamilyGroupQuery(needsGroup ? resolvedGroup?.id : null);

  return { group, needsGroup, isActivityPage: pathname.startsWith("/dashboard/family/activity") };
}

/** Keeps `document.title` in sync with the active route and loaded page data. */
export function useDocumentTitle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const baseLabel = useMemo(
    () => resolveDocumentTitleLabel(pathname, searchParams),
    [pathname, searchParams],
  );

  const { fund, isFundPage } = useMfFundNavbarMeta(pathname);
  const cartMeta = useMfCartNavbarMeta(pathname);
  const isCartMainPage = pathname === "/dashboard/mutual-funds/cart";

  const goalId = extractGoalDetailId(pathname);
  const { goal } = useGoalDetailQuery(goalId ?? "");

  const holdingId = extractPortfolioHoldingId(pathname);
  const { holding } = usePortfolioHoldingDetailQuery(holdingId ?? "");

  const groupRef = searchParams.get("group");
  const { group, needsGroup, isActivityPage } = useFamilyGroupDocumentTitle(pathname, groupRef);

  const collectionSlug = extractMfCollectionSlug(pathname);
  const categorySlug =
    pathname === "/dashboard/mutual-funds/all" ? searchParams.get("category") : null;
  const needsInvestHome = Boolean(collectionSlug || categorySlug);
  const investHomeQuery = useQuery({
    queryKey: queryKeys.invest.home(),
    queryFn: fetchInvestHome,
    enabled: needsInvestHome,
    staleTime: 30_000,
    placeholderData: keepPreviousQueryData,
  });
  const homeData = investHomeQuery.data ?? null;

  const collectionName = useMemo(() => {
    if (!collectionSlug) return null;
    return homeData?.collections?.find((item) => item.slug === collectionSlug)?.name ?? null;
  }, [collectionSlug, homeData?.collections]);

  const categoryName = useMemo(() => {
    if (!categorySlug) return null;
    return homeData?.categories?.find((item) => item.slug === categorySlug)?.name ?? null;
  }, [categorySlug, homeData?.categories]);

  const pageLabel = useMemo(() => {
    if (isFundPage && fund?.amc_name) {
      return fund.amc_name;
    }

    if (isCartMainPage && cartMeta.totalCount > 0) {
      return `${copy.mutualFunds.cartTitle} (${cartMeta.totalCount})`;
    }

    if (goalId && goal?.title) {
      return goal.title;
    }

    if (holdingId && holding?.fundName) {
      return holding.fundName;
    }

    if (needsGroup && group?.title) {
      if (isActivityPage) {
        return `${group.title} / ${copy.familyGroups.activity.tab}`;
      }
      return group.title;
    }

    if (collectionSlug && collectionName) {
      return collectionName;
    }

    if (categorySlug && categoryName) {
      return categoryName;
    }

    return baseLabel;
  }, [
    baseLabel,
    cartMeta.totalCount,
    categoryName,
    categorySlug,
    collectionName,
    collectionSlug,
    fund?.amc_name,
    goal?.title,
    goalId,
    group?.title,
    holding?.fundName,
    holdingId,
    isActivityPage,
    isCartMainPage,
    isFundPage,
    needsGroup,
  ]);

  useLayoutEffect(() => {
    applyDocumentTitle(pageLabel);
  }, [pageLabel]);
}
