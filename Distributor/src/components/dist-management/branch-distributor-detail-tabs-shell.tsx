"use client";

import type { ReactNode } from "react";
import { useCallback, useState, useTransition } from "react";

import { BranchDistributorSectionTabs } from "@/components/dist-management/branch-distributor-section-tabs";
import {
  BRANCH_DISTRIBUTOR_TAB_LABELS,
  type BranchDistributorTabId,
} from "@/components/dist-management/branch-distributor-tab-ids";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import {
  DISTRIBUTOR_BRANCH_DISTRIBUTOR_TABS_ASIDE_CLASS,
  DISTRIBUTOR_BRANCH_DISTRIBUTOR_TABS_BODY_CLASS,
  DISTRIBUTOR_BRANCH_DISTRIBUTOR_TABS_MAIN_CLASS,
  DISTRIBUTOR_TABS_CONTENT_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

export {
  BRANCH_DISTRIBUTOR_TAB_IDS,
  type BranchDistributorTabId,
} from "@/components/dist-management/branch-distributor-tab-ids";

type BranchDistributorDetailTabsShellProps = {
  defaultTab?: BranchDistributorTabId;
  panels: Record<BranchDistributorTabId, ReactNode>;
  aside: ReactNode;
};

export function BranchDistributorDetailTabsShell({
  defaultTab = "overview",
  panels,
  aside,
}: BranchDistributorDetailTabsShellProps) {
  const [activeTab, setActiveTab] = useState<BranchDistributorTabId>(defaultTab);
  const [isTabPending, startTabTransition] = useTransition();

  const onTabChange = useCallback((value: BranchDistributorTabId) => {
    startTabTransition(() => {
      setActiveTab(value);
    });
  }, []);

  return (
    <div className="distributor-branch-distributor-tabs-root">
      <DistributorPageHeader
        title={BRANCH_DISTRIBUTOR_TAB_LABELS[activeTab]}
        titleAs="h2"
        titleSwitchKey={activeTab}
        titleClassName="distributor-client-detail-tab-panel__title"
        className="distributor-client-detail-tabs-header"
      >
        <BranchDistributorSectionTabs
          value={activeTab}
          onChange={onTabChange}
          busy={isTabPending}
        />
      </DistributorPageHeader>

      <div className={DISTRIBUTOR_BRANCH_DISTRIBUTOR_TABS_BODY_CLASS}>
        <aside className={DISTRIBUTOR_BRANCH_DISTRIBUTOR_TABS_ASIDE_CLASS}>{aside}</aside>
        <div className={DISTRIBUTOR_BRANCH_DISTRIBUTOR_TABS_MAIN_CLASS}>
          <div
            key={activeTab}
            role="tabpanel"
            aria-labelledby={`branch-distributor-tab-${activeTab}`}
            id={`branch-distributor-panel-${activeTab}`}
            tabIndex={0}
            className={cn(
              DISTRIBUTOR_TABS_CONTENT_CLASS,
              "distributor-client-detail-tab-panel",
              isTabPending && "distributor-client-detail-tab-panel--pending",
            )}
          >
            {panels[activeTab]}
          </div>
        </div>
      </div>
    </div>
  );
}
