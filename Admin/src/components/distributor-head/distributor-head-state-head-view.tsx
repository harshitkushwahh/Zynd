"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DistributorHeadStateHeadHeroSection } from "@/components/distributor-head/distributor-head-state-head-hero-section";
import {
  DistributorHeadStateHeadBookTab,
  DistributorHeadStateHeadBranchesTab,
  DistributorHeadStateHeadClientsTab,
  DistributorHeadStateHeadLeaveTab,
  DistributorHeadStateHeadManagersTab,
  DistributorHeadStateHeadMitrasTab,
  DistributorHeadStateHeadOverviewTab,
} from "@/components/distributor-head/distributor-head-state-head-tab-panels";
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
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import {
  fetchAdminHierarchyBranches,
  fetchAdminHierarchyManagers,
  fetchAdminHierarchyPartners,
  type AdminHierarchyBranch,
  type AdminHierarchyManager,
  type AdminHierarchyPartner,
  type AdminHierarchyStateHead,
} from "@/lib/admin-distributor-hierarchy-api";
import {
  DISTRIBUTOR_HEAD_STATE_HEAD_TABS,
  DISTRIBUTOR_HEAD_STATE_HEAD_TAB_SLUGS,
  distributorHeadStateHeadTabHref,
  resolveDistributorHeadStateHeadTab,
  type DistributorHeadStateHeadTabKey,
} from "@/lib/admin-distributor-head-state-head-navigation";
import { getLeaveForStateHead } from "@/lib/distributor-head-queries";
import { getErrorMessage, isIgnorableListLoadError } from "@/lib/errors";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { cn } from "@/lib/utils";

type NetworkCacheEntry = {
  managers: AdminHierarchyManager[];
  branches: AdminHierarchyBranch[];
  partners: AdminHierarchyPartner[];
};

const stateHeadNetworkCache = new Map<string, NetworkCacheEntry>();

type DistributorHeadStateHeadViewProps = {
  stateHead: AdminHierarchyStateHead;
  profileTabSlug?: string;
  breadcrumbSegments?: AdminBreadcrumbSegment[];
  canManage?: boolean;
  onUpdated?: (next: AdminHierarchyStateHead) => void;
  onUnassigned?: (stateCode: string, stateName: string) => void;
};

function DistributorHeadStateHeadDetailSkeleton({
  breadcrumbSegments,
}: {
  breadcrumbSegments?: AdminBreadcrumbSegment[];
} = {}) {
  return (
    <div className="distributor-head-state-head-detail min-w-0 max-w-full space-y-6 overflow-x-clip">
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
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
        </div>
      </div>

      <AdminMetricCardsSkeleton count={4} />
      <AdminTabsSkeleton count={7} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`flip-skel-${index}`} className="h-16 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCardSkeleton lines={2} />
        <AdminCardSkeleton lines={2} />
      </div>
    </div>
  );
}

function replaceStateHeadTabUrl(stateHeadId: string, tab: (typeof DISTRIBUTOR_HEAD_STATE_HEAD_TABS)[number]) {
  const href = distributorHeadStateHeadTabHref(stateHeadId, tab);
  if (typeof window === "undefined") return;
  if (window.location.pathname === href) return;
  // Avoid Next catch-all remounts that flash the whole detail page on tab change.
  window.history.replaceState(window.history.state, "", href);
}

export function DistributorHeadStateHeadView({
  stateHead,
  profileTabSlug,
  breadcrumbSegments,
  canManage = false,
  onUpdated,
  onUnassigned,
}: DistributorHeadStateHeadViewProps) {
  const stateHeadId = stateHead.user_id;
  const stateCode = stateHead.state_code;
  const cached = stateHeadNetworkCache.get(stateCode);

  const initialTabKey = resolveDistributorHeadStateHeadTab(profileTabSlug).key;
  const { activeTab: activeTabKey, selectTab, keepMounted } =
    useMountedTabs<DistributorHeadStateHeadTabKey>(initialTabKey);

  const [managers, setManagers] = useState<AdminHierarchyManager[]>(cached?.managers ?? []);
  const [branches, setBranches] = useState<AdminHierarchyBranch[]>(cached?.branches ?? []);
  const [partners, setPartners] = useState<AdminHierarchyPartner[]>(cached?.partners ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  const leaveItems = useMemo(() => getLeaveForStateHead(), []);

  const load = useCallback(async () => {
    const existing = stateHeadNetworkCache.get(stateCode);
    if (existing) {
      setManagers(existing.managers);
      setBranches(existing.branches);
      setPartners(existing.partners);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [managersResult, branchesResult, partnersResult] = await Promise.all([
        fetchAdminHierarchyManagers(),
        fetchAdminHierarchyBranches(),
        fetchAdminHierarchyPartners(),
      ]);
      const nextManagers = managersResult.filter((row) => row.state_code === stateCode);
      const nextBranches = branchesResult.filter((row) => row.state_code === stateCode);
      const branchIds = new Set(nextBranches.map((row) => row.id));
      const nextPartners = partnersResult.filter((row) =>
        row.branch_id ? branchIds.has(row.branch_id) : false,
      );
      const entry = {
        managers: nextManagers,
        branches: nextBranches,
        partners: nextPartners,
      };
      stateHeadNetworkCache.set(stateCode, entry);
      setManagers(nextManagers);
      setBranches(nextBranches);
      setPartners(nextPartners);
    } catch (err) {
      setManagers([]);
      setBranches([]);
      setPartners([]);
      if (!isIgnorableListLoadError(err)) {
        setError(
          getErrorMessage(err, `Could not load ${MITRA_HIERARCHY_COPY.stateHead.toLowerCase()} network.`),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [stateCode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!profileTabSlug) return;
    if (DISTRIBUTOR_HEAD_STATE_HEAD_TAB_SLUGS.has(profileTabSlug)) return;
    const fallback = DISTRIBUTOR_HEAD_STATE_HEAD_TABS[0];
    selectTab(fallback.key);
    replaceStateHeadTabUrl(stateHeadId, fallback);
  }, [profileTabSlug, selectTab, stateHeadId]);

  const aumInr =
    partners.reduce((sum, row) => sum + row.aum_inr, 0) ||
    branches.reduce((sum, row) => sum + row.aum_inr, 0) ||
    stateHead.aum_inr ||
    0;
  const salesMtdInr =
    managers.reduce((sum, row) => sum + row.sales_mtd_inr, 0) ||
    partners.reduce((sum, row) => sum + row.sales_mtd_inr, 0) ||
    stateHead.sales_mtd_inr ||
    0;
  const clientCount =
    partners.reduce((sum, row) => sum + row.client_count, 0) ||
    branches.reduce((sum, row) => sum + row.active_clients, 0) ||
    stateHead.client_count ||
    0;
  const pendingBranchCount = branches.filter((row) => row.status === "pending_approval").length;
  const unassignedBranchCount = branches.filter((row) => !row.manager_id).length;
  const pendingLeaveCount = leaveItems.filter((row) => row.status === "Pending").length;
  const activePartnerCount = partners.filter((row) => row.status === "Active").length;
  const activeManagerCount = managers.filter((row) => row.status === "Active").length;

  const handleTabChange = (value: string) => {
    const tab = DISTRIBUTOR_HEAD_STATE_HEAD_TABS.find((item) => item.key === value);
    if (!tab || tab.key === activeTabKey) return;
    selectTab(tab.key);
    replaceStateHeadTabUrl(stateHeadId, tab);
  };

  if (loading) {
    return <DistributorHeadStateHeadDetailSkeleton breadcrumbSegments={breadcrumbSegments} />;
  }

  return (
    <div className="distributor-head-state-head-detail min-w-0 max-w-full space-y-6 overflow-x-clip">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}

      <DistributorHeadStateHeadHeroSection
        stateHead={stateHead}
        activeManagerCount={activeManagerCount}
        branchCount={branches.length}
        partnerCount={partners.length}
        activePartnerCount={activePartnerCount}
        clientCount={clientCount}
        aumInr={aumInr}
        salesMtdInr={salesMtdInr}
        pendingBranchCount={pendingBranchCount}
        unassignedBranchCount={unassignedBranchCount}
        pendingLeaveCount={pendingLeaveCount}
        breadcrumb={
          breadcrumbSegments?.length ? (
            <AdminSectionBreadcrumb segments={breadcrumbSegments} />
          ) : undefined
        }
        canManage={canManage}
        onUpdated={onUpdated}
        onUnassigned={onUnassigned}
      />

      <Tabs value={activeTabKey} onValueChange={handleTabChange} className="gap-6">
        <AdminTabList variant="primary" className="max-w-full overflow-x-auto">
          {DISTRIBUTOR_HEAD_STATE_HEAD_TABS.map((tab) => {
            const Icon = tab.icon;
            const count =
              tab.key === "managers"
                ? managers.length
                : tab.key === "branches"
                  ? branches.length
                  : tab.key === "mitras"
                    ? partners.length
                    : tab.key === "clients"
                      ? clientCount
                      : tab.key === "leave"
                        ? leaveItems.length
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
          className={cn("distributor-head-state-head-detail__panel mt-0")}
        >
          <DistributorHeadStateHeadOverviewTab
            managers={managers}
            branches={branches}
            partners={partners}
            leaveItems={leaveItems}
            aumInr={aumInr}
            salesMtdInr={salesMtdInr}
            clientCount={clientCount}
          />
        </TabsContent>
        <TabsContent
          value="managers"
          keepMounted={keepMounted("managers")}
          className="distributor-head-state-head-detail__panel mt-0"
        >
          <DistributorHeadStateHeadManagersTab managers={managers} />
        </TabsContent>
        <TabsContent
          value="branches"
          keepMounted={keepMounted("branches")}
          className="distributor-head-state-head-detail__panel mt-0"
        >
          <DistributorHeadStateHeadBranchesTab branches={branches} />
        </TabsContent>
        <TabsContent
          value="mitras"
          keepMounted={keepMounted("mitras")}
          className="distributor-head-state-head-detail__panel mt-0"
        >
          <DistributorHeadStateHeadMitrasTab partners={partners} />
        </TabsContent>
        <TabsContent
          value="book"
          keepMounted={keepMounted("book")}
          className="distributor-head-state-head-detail__panel mt-0"
        >
          <DistributorHeadStateHeadBookTab
            managers={managers}
            partners={partners}
            aumInr={aumInr}
            salesMtdInr={salesMtdInr}
            clientCount={clientCount}
          />
        </TabsContent>
        <TabsContent
          value="clients"
          keepMounted={keepMounted("clients")}
          className="distributor-head-state-head-detail__panel mt-0"
        >
          <DistributorHeadStateHeadClientsTab partners={partners} />
        </TabsContent>
        <TabsContent
          value="leave"
          keepMounted={keepMounted("leave")}
          className="distributor-head-state-head-detail__panel mt-0"
        >
          <DistributorHeadStateHeadLeaveTab leaveItems={leaveItems} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { DistributorHeadStateHeadDetailSkeleton };
