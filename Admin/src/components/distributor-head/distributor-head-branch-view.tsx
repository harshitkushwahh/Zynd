"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DistributorHeadBranchHeroSection } from "@/components/distributor-head/distributor-head-branch-hero-section";
import {
  DistributorHeadBranchBookTab,
  DistributorHeadBranchClientsTab,
  DistributorHeadBranchMitrasTab,
  DistributorHeadBranchOverviewTab,
} from "@/components/distributor-head/distributor-head-branch-tab-panels";
import { DistributorHeadBranchActivityTab } from "@/components/distributor-head/distributor-head-branch-activity-tab";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminCardSkeleton,
  AdminMetricCardsSkeleton,
  AdminTabsSkeleton,
} from "@/components/ui/admin-skeletons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import {
  AdminSectionBreadcrumb,
  type AdminBreadcrumbSegment,
} from "@/components/dashboard/admin-section-breadcrumb";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import {
  DISTRIBUTOR_HEAD_BRANCHES_APPROVE_PERMISSION,
  DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION,
} from "@/lib/admin-distributor-head-navigation";
import {
  fetchAdminHierarchyBranch,
  fetchAdminHierarchyPartners,
  type AdminHierarchyBranchDetail,
  type AdminHierarchyPartner,
} from "@/lib/admin-distributor-hierarchy-api";
import {
  DISTRIBUTOR_HEAD_BRANCH_TABS,
  DISTRIBUTOR_HEAD_BRANCH_TAB_SLUGS,
  distributorHeadBranchTabHref,
  resolveDistributorHeadBranchTab,
  type DistributorHeadBranchTabKey,
} from "@/lib/admin-distributor-head-branch-navigation";
import { getErrorMessage, isIgnorableListLoadError } from "@/lib/errors";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { cn } from "@/lib/utils";

type BranchNetworkCacheEntry = {
  partners: AdminHierarchyPartner[];
};

const branchNetworkCache = new Map<string, BranchNetworkCacheEntry>();

type DistributorHeadBranchViewProps = {
  branch: AdminHierarchyBranchDetail;
  profileTabSlug?: string;
  breadcrumbSegments?: AdminBreadcrumbSegment[];
  onUpdated?: (next: AdminHierarchyBranchDetail) => void;
};

function replaceBranchTabUrl(branchId: string, tab: (typeof DISTRIBUTOR_HEAD_BRANCH_TABS)[number]) {
  const href = distributorHeadBranchTabHref(branchId, tab);
  if (typeof window === "undefined") return;
  if (window.location.pathname === href) return;
  window.history.replaceState(window.history.state, "", href);
}

function DistributorHeadBranchDetailSkeleton({
  breadcrumbSegments,
}: {
  breadcrumbSegments?: AdminBreadcrumbSegment[];
} = {}) {
  return (
    <div className="distributor-head-branch-detail min-w-0 max-w-full space-y-6">
      {breadcrumbSegments?.length ? (
        <AdminSectionBreadcrumb segments={breadcrumbSegments} />
      ) : (
        <Skeleton className="h-4 w-72 max-w-full" />
      )}

      <div className="w-full min-w-0 rounded-card border border-border/80 bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-14 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-6 w-44 max-w-full" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
        </div>
      </div>

      <AdminMetricCardsSkeleton count={4} />
      <AdminTabsSkeleton count={5} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`flip-skel-${index}`} className="h-16 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCardSkeleton lines={4} />
        <AdminCardSkeleton lines={2} />
      </div>
    </div>
  );
}

export function DistributorHeadBranchView({
  branch,
  profileTabSlug,
  breadcrumbSegments,
  onUpdated,
}: DistributorHeadBranchViewProps) {
  const { hasPermission, user } = useAdminAuth();
  const branchId = branch.id;
  const cached = branchNetworkCache.get(branchId);

  const canApproveBranches = hasPermission(DISTRIBUTOR_HEAD_BRANCHES_APPROVE_PERMISSION);
  const canManageBranches = hasPermission(DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION);

  const initialTabKey = resolveDistributorHeadBranchTab(profileTabSlug).key;
  const { activeTab: activeTabKey, selectTab, keepMounted } =
    useMountedTabs<DistributorHeadBranchTabKey>(initialTabKey);

  const [partners, setPartners] = useState<AdminHierarchyPartner[]>(cached?.partners ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  const loadPartners = useCallback(async () => {
    const existing = branchNetworkCache.get(branchId);
    if (existing) {
      setPartners(existing.partners);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const partnersResult = await fetchAdminHierarchyPartners();
      const nextPartners = partnersResult.filter((row) => row.branch_id === branchId);
      branchNetworkCache.set(branchId, { partners: nextPartners });
      setPartners(nextPartners);
    } catch (err) {
      setPartners([]);
      if (!isIgnorableListLoadError(err)) {
        setError(getErrorMessage(err, "Could not load branch network."));
      }
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  useEffect(() => {
    if (!profileTabSlug) return;
    if (DISTRIBUTOR_HEAD_BRANCH_TAB_SLUGS.has(profileTabSlug)) return;
    const fallback = DISTRIBUTOR_HEAD_BRANCH_TABS[0];
    selectTab(fallback.key);
    replaceBranchTabUrl(branchId, fallback);
  }, [branchId, profileTabSlug, selectTab]);

  const refreshBranch = useCallback(async () => {
    try {
      const next = await fetchAdminHierarchyBranch(branchId);
      branchNetworkCache.delete(branchId);
      onUpdated?.(next);
      await loadPartners();
    } catch (err) {
      setError(getErrorMessage(err, "Could not refresh branch."));
    }
  }, [branchId, loadPartners, onUpdated]);

  const clientCount =
    partners.reduce((sum, row) => sum + row.client_count, 0) || branch.active_clients || 0;
  const aumInr = partners.reduce((sum, row) => sum + row.aum_inr, 0) || branch.aum_inr || 0;
  const salesMtdInr =
    partners.reduce((sum, row) => sum + row.sales_mtd_inr, 0) || branch.sales_mtd_inr || 0;
  const activePartnerCount =
    partners.filter((row) => row.status === "Active").length ||
    branch.active_partner_count ||
    0;

  const handleTabChange = (value: string) => {
    const tab = DISTRIBUTOR_HEAD_BRANCH_TABS.find((item) => item.key === value);
    if (!tab || tab.key === activeTabKey) return;
    selectTab(tab.key);
    replaceBranchTabUrl(branchId, tab);
  };

  const handleBranchUpdated = (next: AdminHierarchyBranchDetail) => {
    onUpdated?.(next);
  };

  if (loading) {
    return <DistributorHeadBranchDetailSkeleton breadcrumbSegments={breadcrumbSegments} />;
  }

  return (
    <div className="distributor-head-branch-detail min-w-0 max-w-full space-y-6">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      <DistributorHeadBranchHeroSection
        branch={branch}
        activePartnerCount={activePartnerCount}
        clientCount={clientCount}
        aumInr={aumInr}
        salesMtdInr={salesMtdInr}
        breadcrumb={
          breadcrumbSegments?.length ? (
            <AdminSectionBreadcrumb segments={breadcrumbSegments} />
          ) : undefined
        }
        canApprove={canApproveBranches}
        canManage={canManageBranches}
        currentUserId={user?.id}
        onUpdated={handleBranchUpdated}
        onAssigned={() => void refreshBranch()}
      />

      <Tabs value={activeTabKey} onValueChange={handleTabChange} className="gap-6">
        <AdminTabList variant="primary" className="max-w-full overflow-x-auto">
          {DISTRIBUTOR_HEAD_BRANCH_TABS.map((tab) => {
            const Icon = tab.icon;
            const count =
              tab.key === "mitras"
                ? partners.length
                : tab.key === "clients"
                  ? clientCount
                  : null;
            return (
              <AdminTabTrigger key={tab.key} value={tab.key} className="gap-2">
                <Icon className="size-4 shrink-0" />
                {tab.label}
                {count != null ? (
                  <Badge variant="secondary" className="h-5 px-1.5 tabular-nums font-normal">
                    {count}
                  </Badge>
                ) : null}
              </AdminTabTrigger>
            );
          })}
        </AdminTabList>

        <TabsContent
          value="overview"
          keepMounted={keepMounted("overview")}
          className={cn("distributor-head-branch-detail__panel mt-0")}
        >
          <DistributorHeadBranchOverviewTab
            branch={branch}
            partners={partners}
            clientCount={clientCount}
            aumInr={aumInr}
            salesMtdInr={salesMtdInr}
          />
        </TabsContent>
        <TabsContent
          value="mitras"
          keepMounted={keepMounted("mitras")}
          className="distributor-head-branch-detail__panel mt-0"
        >
          <DistributorHeadBranchMitrasTab partners={partners} />
        </TabsContent>
        <TabsContent
          value="clients"
          keepMounted={keepMounted("clients")}
          className="distributor-head-branch-detail__panel mt-0"
        >
          <DistributorHeadBranchClientsTab partners={partners} />
        </TabsContent>
        <TabsContent
          value="book"
          keepMounted={keepMounted("book")}
          className="distributor-head-branch-detail__panel mt-0"
        >
          <DistributorHeadBranchBookTab
            branch={branch}
            partners={partners}
            aumInr={aumInr}
            salesMtdInr={salesMtdInr}
            clientCount={clientCount}
          />
        </TabsContent>
        <TabsContent
          value="activity"
          keepMounted={keepMounted("activity")}
          className="distributor-head-branch-detail__panel mt-0"
        >
          <DistributorHeadBranchActivityTab branch={branch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { DistributorHeadBranchDetailSkeleton };
