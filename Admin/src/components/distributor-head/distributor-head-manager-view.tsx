"use client";

import { useEffect, useMemo } from "react";

import { DistributorHeadManagerActivityTab } from "@/components/distributor-head/distributor-head-manager-activity-tab";
import { DistributorHeadManagerBookTab } from "@/components/distributor-head/distributor-head-manager-book-tab";
import { DistributorHeadManagerClientsTab } from "@/components/distributor-head/distributor-head-manager-clients-tab";
import { DistributorHeadManagerDistributorsTab } from "@/components/distributor-head/distributor-head-manager-distributors-tab";
import { DistributorHeadManagerHeroSection } from "@/components/distributor-head/distributor-head-manager-hero-section";
import { DistributorHeadManagerLeaveTab } from "@/components/distributor-head/distributor-head-manager-leave-tab";
import { DistributorHeadManagerOverviewPanel } from "@/components/distributor-head/distributor-head-manager-overview-panel";
import {
  AdminSectionBreadcrumb,
  type AdminBreadcrumbSegment,
} from "@/components/dashboard/admin-section-breadcrumb";
import {
  AdminCardSkeleton,
  AdminMetricCardsSkeleton,
  AdminTabsSkeleton,
} from "@/components/ui/admin-skeletons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import {
  DISTRIBUTOR_HEAD_MANAGER_TABS,
  DISTRIBUTOR_HEAD_MANAGER_TAB_SLUGS,
  distributorHeadManagerTabHref,
  resolveDistributorHeadManagerTab,
  type DistributorHeadManagerTabKey,
} from "@/lib/admin-distributor-head-manager-navigation";
import type { DistributorHeadManager } from "@/lib/dummy/distributor-head-data";
import {
  getAuditLogsForManager,
  getBranchesForManager,
  getClientsForManager,
  getDistributorsForManager,
  getIncentiveForManager,
  getLeaveForManager,
  getManagerBookSummary,
  getManagerOwnLeave,
  getPurchasesForManager,
  getSipPlansForManager,
  getTeamLeaveForManager,
} from "@/lib/distributor-head-queries";
import { cn } from "@/lib/utils";

type DistributorHeadManagerViewProps = {
  manager: DistributorHeadManager;
  profileTabSlug?: string;
  breadcrumbSegments?: AdminBreadcrumbSegment[];
};

function replaceManagerTabUrl(
  managerId: string,
  tab: (typeof DISTRIBUTOR_HEAD_MANAGER_TABS)[number],
) {
  const href = distributorHeadManagerTabHref(managerId, tab);
  if (typeof window === "undefined") return;
  if (window.location.pathname === href) return;
  window.history.replaceState(window.history.state, "", href);
}

export function DistributorHeadManagerDetailSkeleton({
  breadcrumbSegments,
}: {
  breadcrumbSegments?: AdminBreadcrumbSegment[];
} = {}) {
  return (
    <div className="distributor-head-manager-detail min-w-0 max-w-full space-y-6">
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
      <AdminTabsSkeleton count={6} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCardSkeleton lines={2} />
        <AdminCardSkeleton lines={2} />
      </div>
    </div>
  );
}

export function DistributorHeadManagerView({
  manager,
  profileTabSlug,
  breadcrumbSegments,
}: DistributorHeadManagerViewProps) {
  const managerId = manager.id;

  const activeProfileTab = resolveDistributorHeadManagerTab(profileTabSlug);
  const { activeTab: activeTabKey, selectTab, keepMounted } = useMountedTabs<DistributorHeadManagerTabKey>(
    activeProfileTab.key,
  );

  const branches = useMemo(() => getBranchesForManager(managerId), [managerId]);
  const distributors = useMemo(() => getDistributorsForManager(managerId), [managerId]);
  const clients = useMemo(() => getClientsForManager(managerId), [managerId]);
  const incentive = useMemo(() => getIncentiveForManager(managerId), [managerId]);
  const leaveItems = useMemo(() => getLeaveForManager(managerId), [managerId]);
  const managerLeave = useMemo(() => getManagerOwnLeave(managerId), [managerId]);
  const teamLeave = useMemo(() => getTeamLeaveForManager(managerId), [managerId]);
  const sips = useMemo(() => getSipPlansForManager(managerId), [managerId]);
  const purchases = useMemo(() => getPurchasesForManager(managerId), [managerId]);
  const auditLogs = useMemo(() => getAuditLogsForManager(managerId), [managerId]);
  const book = useMemo(() => getManagerBookSummary(managerId), [managerId]);

  const activeDistributors = distributors.filter((row) => row.status === "Active").length;
  const pendingManagerLeave = managerLeave.filter((row) => row.status === "Pending").length;

  useEffect(() => {
    if (!profileTabSlug) return;
    if (DISTRIBUTOR_HEAD_MANAGER_TAB_SLUGS.has(profileTabSlug)) return;
    const fallback = DISTRIBUTOR_HEAD_MANAGER_TABS[0];
    selectTab(fallback.key);
    replaceManagerTabUrl(managerId, fallback);
  }, [managerId, profileTabSlug, selectTab]);

  const handleTabChange = (value: string) => {
    const tab = DISTRIBUTOR_HEAD_MANAGER_TABS.find((item) => item.key === value);
    if (!tab || tab.key === activeTabKey) return;
    selectTab(tab.key);
    replaceManagerTabUrl(managerId, tab);
  };

  return (
    <div className="distributor-head-manager-detail min-w-0 max-w-full space-y-6">
      <DistributorHeadManagerHeroSection
        manager={manager}
        branchCount={branches.length}
        distributorCount={distributors.length}
        activeDistributors={activeDistributors}
        pendingManagerLeave={pendingManagerLeave}
        book={book}
        breadcrumb={
          breadcrumbSegments?.length ? (
            <AdminSectionBreadcrumb segments={breadcrumbSegments} />
          ) : undefined
        }
      />

      <Tabs value={activeTabKey} onValueChange={handleTabChange} className="gap-6">
        <AdminTabList variant="primary" className="max-w-full overflow-x-auto">
          {DISTRIBUTOR_HEAD_MANAGER_TABS.map((tab) => {
            const Icon = tab.icon;
            const count =
              tab.key === "distributors"
                ? distributors.length
                : tab.key === "clients"
                  ? clients.length
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
          className={cn("distributor-head-manager-detail__panel mt-0")}
        >
          <DistributorHeadManagerOverviewPanel
            branches={branches}
            leaveItems={leaveItems}
            incentive={incentive}
          />
        </TabsContent>

        <TabsContent
          value="distributors"
          keepMounted={keepMounted("distributors")}
          className="distributor-head-manager-detail__panel mt-0"
        >
          <DistributorHeadManagerDistributorsTab team={distributors} />
        </TabsContent>

        <TabsContent
          value="clients"
          keepMounted={keepMounted("clients")}
          className="distributor-head-manager-detail__panel mt-0"
        >
          <DistributorHeadManagerClientsTab clients={clients} />
        </TabsContent>

        <TabsContent
          value="book"
          keepMounted={keepMounted("book")}
          className="distributor-head-manager-detail__panel mt-0"
        >
          <DistributorHeadManagerBookTab book={book} sips={sips} purchases={purchases} />
        </TabsContent>

        <TabsContent
          value="leave"
          keepMounted={keepMounted("leave")}
          className="distributor-head-manager-detail__panel mt-0"
        >
          <DistributorHeadManagerLeaveTab managerLeave={managerLeave} teamLeave={teamLeave} />
        </TabsContent>

        <TabsContent
          value="activity"
          keepMounted={keepMounted("activity")}
          className="distributor-head-manager-detail__panel mt-0"
        >
          <DistributorHeadManagerActivityTab logs={auditLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
