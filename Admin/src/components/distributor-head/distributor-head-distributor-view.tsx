"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { DistributorHeadDistributorActivityTab } from "@/components/distributor-head/distributor-head-distributor-activity-tab";
import { DistributorHeadDistributorBookTab } from "@/components/distributor-head/distributor-head-distributor-book-tab";
import { DistributorHeadDistributorClientsTab } from "@/components/distributor-head/distributor-head-distributor-clients-tab";
import { DistributorHeadDistributorHeroSection } from "@/components/distributor-head/distributor-head-distributor-hero-section";
import { DistributorHeadDistributorLeaveTab } from "@/components/distributor-head/distributor-head-distributor-leave-tab";
import { DistributorHeadDistributorOverviewPanel } from "@/components/distributor-head/distributor-head-distributor-overview-panel";
import { DistributorHeadDistributorReportsTab } from "@/components/distributor-head/distributor-head-distributor-reports-tab";
import { DistributorHeadDistributorWorkTab } from "@/components/distributor-head/distributor-head-distributor-work-tab";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import {
  DISTRIBUTOR_HEAD_DISTRIBUTOR_TABS,
  DISTRIBUTOR_HEAD_DISTRIBUTOR_TAB_SLUGS,
  distributorHeadDistributorTabHref,
  resolveDistributorHeadDistributorTab,
  type DistributorHeadDistributorTabKey,
} from "@/lib/admin-distributor-head-distributor-navigation";
import type { DistributorHeadDistributor } from "@/lib/dummy/distributor-head-data";
import {
  getAuditLogsForDistributor,
  getAumTrendForDistributor,
  getBookHoldingsForDistributor,
  getClientsForDistributor,
  getDistributorBookSummary,
  getLeaveForDistributor,
  getPurchasesForDistributor,
  getReportRollupForDistributor,
  getSipPlansForDistributor,
  getWorkAttendanceForDistributor,
  getWorkHoursForDistributor,
} from "@/lib/distributor-head-queries";

type DistributorHeadDistributorViewProps = {
  distributor: DistributorHeadDistributor;
  profileTabSlug?: string;
};

export function DistributorHeadDistributorView({
  distributor,
  profileTabSlug,
}: DistributorHeadDistributorViewProps) {
  const router = useRouter();
  const distributorId = distributor.id;

  const activeProfileTab = resolveDistributorHeadDistributorTab(profileTabSlug);
  const { activeTab: activeTabKey, selectTab, keepMounted } = useMountedTabs<DistributorHeadDistributorTabKey>(
    activeProfileTab.key,
    activeProfileTab.key,
  );

  const clients = useMemo(() => getClientsForDistributor(distributorId), [distributorId]);
  const sips = useMemo(() => getSipPlansForDistributor(distributorId), [distributorId]);
  const purchases = useMemo(() => getPurchasesForDistributor(distributorId), [distributorId]);
  const auditLogs = useMemo(() => getAuditLogsForDistributor(distributorId), [distributorId]);
  const leaveItems = useMemo(() => getLeaveForDistributor(distributorId), [distributorId]);
  const book = useMemo(() => getDistributorBookSummary(distributorId), [distributorId]);
  const aumTrend = useMemo(() => getAumTrendForDistributor(distributorId), [distributorId]);
  const holdings = useMemo(() => getBookHoldingsForDistributor(distributorId), [distributorId]);
  const reportRollup = useMemo(() => getReportRollupForDistributor(distributorId), [distributorId]);
  const workHours = useMemo(() => getWorkHoursForDistributor(distributorId), [distributorId]);
  const attendance = useMemo(() => getWorkAttendanceForDistributor(distributorId), [distributorId]);

  useEffect(() => {
    if (!profileTabSlug) return;
    if (DISTRIBUTOR_HEAD_DISTRIBUTOR_TAB_SLUGS.has(profileTabSlug)) return;
    router.replace(
      distributorHeadDistributorTabHref(distributorId, DISTRIBUTOR_HEAD_DISTRIBUTOR_TABS[0]),
      { scroll: false },
    );
  }, [distributorId, profileTabSlug, router]);

  const handleTabChange = (value: string) => {
    const tab = DISTRIBUTOR_HEAD_DISTRIBUTOR_TABS.find((item) => item.key === value);
    if (!tab) return;
    selectTab(tab.key);
    router.push(distributorHeadDistributorTabHref(distributorId, tab), { scroll: false });
  };

  return (
    <div className="space-y-6">
      <DistributorHeadDistributorHeroSection
        distributor={distributor}
        book={book}
        managerName={distributor.managerName}
        managerId={distributor.managerId}
      />

      <Tabs value={activeTabKey} onValueChange={handleTabChange} className="gap-6">
        <AdminTabList variant="primary">
          {DISTRIBUTOR_HEAD_DISTRIBUTOR_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tab.key === "clients" ? clients.length : null;
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
          <DistributorHeadDistributorOverviewPanel
            distributor={distributor}
            managerName={distributor.managerName}
            managerId={distributor.managerId}
            aumTrend={aumTrend}
            holdings={holdings}
          />
        </TabsContent>

        <TabsContent value="clients" keepMounted={keepMounted("clients")} className="mt-0">
          <DistributorHeadDistributorClientsTab clients={clients} />
        </TabsContent>

        <TabsContent value="book" keepMounted={keepMounted("book")} className="mt-0">
          <DistributorHeadDistributorBookTab book={book} sips={sips} purchases={purchases} />
        </TabsContent>

        <TabsContent value="reports" keepMounted={keepMounted("reports")} className="mt-0">
          <DistributorHeadDistributorReportsTab rollup={reportRollup} />
        </TabsContent>

        <TabsContent value="leave" keepMounted={keepMounted("leave")} className="mt-0">
          <DistributorHeadDistributorLeaveTab leaveItems={leaveItems} />
        </TabsContent>

        <TabsContent value="work" keepMounted={keepMounted("work")} className="mt-0">
          <DistributorHeadDistributorWorkTab workHours={workHours} attendance={attendance} />
        </TabsContent>

        <TabsContent value="activity" keepMounted={keepMounted("activity")} className="mt-0">
          <DistributorHeadDistributorActivityTab logs={auditLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
