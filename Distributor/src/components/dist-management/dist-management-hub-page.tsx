"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { BranchCommissionsPanel } from "@/components/dist-management/branch-commissions-panel";
import { BranchReportsPanel } from "@/components/dist-management/branch-reports-panel";
import { BranchTeamPerformancePanel } from "@/components/dist-management/branch-team-performance-panel";
import { DistManagementHubPageSkeleton } from "@/components/dist-management/dist-management-hub-page-skeleton";
import {
  DistManagementHubTabs,
} from "@/components/dist-management/dist-management-hub-tabs";
import { useDistributorScopePageReveal } from "@/components/dashboard/use-distributor-scope-page-reveal";
import { distManagementHubTabTitle } from "@/lib/dist-management-hub-tabs";
import {
  buildDistManagementHubHref,
  resolveDistManagementHubTab,
  type DistManagementHubTabId,
} from "@/lib/dist-management-hub-tabs";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DISTRIBUTOR_PAGE_CONFIG } from "@/lib/distributor-page-config";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { DISTRIBUTOR_PAGE_STACK_CLASS, DISTRIBUTOR_TABS_CONTENT_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

export function DistManagementHubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: authLoading } = useDistributorAuth();
  const activeTab = resolveDistManagementHubTab(searchParams.get("tab"));
  const [isPending, startTransition] = useTransition();
  const { showSkeleton } = useDistributorScopePageReveal({ ready: !authLoading });

  const onTabChange = useCallback(
    (tab: DistManagementHubTabId) => {
      startTransition(() => {
        router.replace(buildDistManagementHubHref(tab), { scroll: false });
      });
    },
    [router],
  );

  const sectionTitle = distManagementHubTabTitle(activeTab);

  if (showSkeleton) {
    return <DistManagementHubPageSkeleton />;
  }

  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, "distributor-scope-page--enter")}>
      <DistributorPageHeader
        title={sectionTitle}
        titleSwitchKey={activeTab}
        titleClassName="distributor-client-detail-tab-panel__title"
        className="distributor-client-detail-tabs-header"
      >
        <DistManagementHubTabs value={activeTab} onChange={onTabChange} busy={isPending} />
      </DistributorPageHeader>

      <div
        key={activeTab}
        role="tabpanel"
        id={`dist-management-hub-panel-${activeTab}`}
        aria-labelledby={`dist-management-hub-tab-${activeTab}`}
        className={cn(
          DISTRIBUTOR_TABS_CONTENT_CLASS,
          "distributor-client-detail-tab-panel",
          isPending && "distributor-client-detail-tab-panel--pending",
        )}
      >
        {activeTab === "commissions" ? (
          <BranchCommissionsPanel {...DISTRIBUTOR_PAGE_CONFIG.branchCommissions} embedded />
        ) : null}
        {activeTab === "performance" ? (
          <BranchTeamPerformancePanel {...DISTRIBUTOR_PAGE_CONFIG.branchPerformance} embedded />
        ) : null}
        {activeTab === "reports" ? (
          <BranchReportsPanel {...DISTRIBUTOR_PAGE_CONFIG.branchReports} embedded />
        ) : null}
      </div>
    </div>
  );
}
