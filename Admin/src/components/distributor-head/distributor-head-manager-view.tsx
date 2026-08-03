"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { DistributorHeadManagerActivityTab } from "@/components/distributor-head/distributor-head-manager-activity-tab";
import { DistributorHeadManagerBookTab } from "@/components/distributor-head/distributor-head-manager-book-tab";
import { DistributorHeadManagerClientsTab } from "@/components/distributor-head/distributor-head-manager-clients-tab";
import { DistributorHeadManagerDistributorsTab } from "@/components/distributor-head/distributor-head-manager-distributors-tab";
import { DistributorHeadManagerHeroSection } from "@/components/distributor-head/distributor-head-manager-hero-section";
import { DistributorHeadManagerLeaveTab } from "@/components/distributor-head/distributor-head-manager-leave-tab";
import { DistributorHeadManagerOverviewPanel } from "@/components/distributor-head/distributor-head-manager-overview-panel";
import { Badge } from "@/components/ui/badge";
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

type DistributorHeadManagerViewProps = {
  manager: DistributorHeadManager;
  profileTabSlug?: string;
};

export function DistributorHeadManagerView({
  manager,
  profileTabSlug,
}: DistributorHeadManagerViewProps) {
  const router = useRouter();
  const managerId = manager.id;

  const activeProfileTab = resolveDistributorHeadManagerTab(profileTabSlug);
  const { activeTab: activeTabKey, selectTab, keepMounted } = useMountedTabs<DistributorHeadManagerTabKey>(
    activeProfileTab.key,
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
    router.replace(distributorHeadManagerTabHref(managerId, DISTRIBUTOR_HEAD_MANAGER_TABS[0]), {
      scroll: false,
    });
  }, [managerId, profileTabSlug, router]);

  const handleTabChange = (value: string) => {
    const tab = DISTRIBUTOR_HEAD_MANAGER_TABS.find((item) => item.key === value);
    if (!tab) return;
    selectTab(tab.key);
    router.push(distributorHeadManagerTabHref(managerId, tab), { scroll: false });
  };

  return (
    <div className="space-y-6">
      <DistributorHeadManagerHeroSection
        manager={manager}
        branchCount={branches.length}
        distributorCount={distributors.length}
        activeDistributors={activeDistributors}
        pendingManagerLeave={pendingManagerLeave}
        book={book}
      />

      <Tabs value={activeTabKey} onValueChange={handleTabChange} className="gap-6">
        <AdminTabList variant="primary">
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

        <TabsContent value="overview" keepMounted={keepMounted("overview")} className="mt-0">
          <DistributorHeadManagerOverviewPanel
            branches={branches}
            leaveItems={leaveItems}
            incentive={incentive}
          />
        </TabsContent>

        <TabsContent value="distributors" keepMounted={keepMounted("distributors")} className="mt-0">
          <DistributorHeadManagerDistributorsTab team={distributors} />
        </TabsContent>

        <TabsContent value="clients" keepMounted={keepMounted("clients")} className="mt-0">
          <DistributorHeadManagerClientsTab clients={clients} />
        </TabsContent>

        <TabsContent value="book" keepMounted={keepMounted("book")} className="mt-0">
          <DistributorHeadManagerBookTab book={book} sips={sips} purchases={purchases} />
        </TabsContent>

        <TabsContent value="leave" keepMounted={keepMounted("leave")} className="mt-0">
          <DistributorHeadManagerLeaveTab managerLeave={managerLeave} teamLeave={teamLeave} />
        </TabsContent>

        <TabsContent value="activity" keepMounted={keepMounted("activity")} className="mt-0">
          <DistributorHeadManagerActivityTab logs={auditLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
