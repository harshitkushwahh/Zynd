"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Crown } from "lucide-react";

import {
  DistributorHeadBranchesPanel,
  DistributorHeadOverviewPanel,
  DistributorHeadSalesPanel,
} from "@/components/distributor-head/distributor-head-tab-panels";
import { DistributorHeadManagersPanel } from "@/components/distributor-head/distributor-head-managers-panel";
import { DistributorHeadDistributorsPanel } from "@/components/distributor-head/distributor-head-distributors-panel";
import { DistributorHeadManagerDetail } from "@/components/distributor-head/distributor-head-manager-detail";
import { DistributorHeadDistributorDetail } from "@/components/distributor-head/distributor-head-distributor-detail";
import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { DistributorHeadStateBadges } from "@/components/distributor-head/distributor-head-state-badges";
import { Tabs } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import {
  DISTRIBUTOR_HEAD_TABS,
  distributorHeadTabHref,
  type DistributorHeadTabId,
} from "@/lib/admin-distributor-head-navigation";
import {
  getDistributorHeadDistributor,
  getDistributorHeadManager,
  isDistributorHeadTabId,
} from "@/lib/distributor-head-queries";

type DistributorHeadPageProps = {
  segments?: string[];
};

function resolveListTab(segments?: string[]): DistributorHeadTabId {
  const first = segments?.[0];
  if (isDistributorHeadTabId(first)) return first;
  return "overview";
}

function resolveActiveTabId(segments?: string[]): DistributorHeadTabId {
  const tabSlug = segments?.[0];
  const entityId = segments?.[1];
  if (entityId && tabSlug && isDistributorHeadTabId(tabSlug)) {
    return tabSlug;
  }
  if (tabSlug && isDistributorHeadTabId(tabSlug)) {
    return tabSlug;
  }
  return "overview";
}

export function DistributorHeadPage({ segments }: DistributorHeadPageProps) {
  const router = useRouter();
  const tabSlug = segments?.[0];
  const entityId = segments?.[1];
  const listTabId = resolveListTab(segments);
  const activeTabId = useMemo(() => resolveActiveTabId(segments), [segments]);

  const managerDetail =
    listTabId === "managers" && entityId ? getDistributorHeadManager(entityId) : undefined;
  const distributorDetail =
    listTabId === "distributors" && entityId
      ? getDistributorHeadDistributor(entityId)
      : undefined;
  const isDetailView = Boolean(managerDetail || distributorDetail);

  useEffect(() => {
    if (entityId) return;
    if (!tabSlug) return;
    if (isDistributorHeadTabId(tabSlug)) return;
    router.replace("/dashboard/distributor-head");
  }, [entityId, router, tabSlug]);

  const handleTabChange = (value: string | number | null) => {
    if (value == null || typeof value !== "string") return;
    const nextTab = DISTRIBUTOR_HEAD_TABS.find((tab) => tab.id === value);
    if (!nextTab) return;
    router.push(distributorHeadTabHref(nextTab));
  };

  const breadcrumbSegments = [{ label: "Platform" }, { label: "Distributor Head", href: "/dashboard/distributor-head" }];
  if (managerDetail) {
    breadcrumbSegments.push(
      { label: "Managers", href: "/dashboard/distributor-head/managers" },
      { label: managerDetail.name },
    );
  } else if (distributorDetail) {
    breadcrumbSegments.push(
      { label: "Distributors", href: "/dashboard/distributor-head/distributors" },
      { label: distributorDetail.name },
    );
  }

  const pageTitle = managerDetail
    ? managerDetail.name
    : distributorDetail
      ? distributorDetail.name
      : "Distributor Head";

  return (
    <AdminSectionPageShell
      breadcrumbSegments={breadcrumbSegments}
      title={pageTitle}
      titleAddon={isDetailView ? undefined : <DistributorHeadStateBadges />}
      headerAside={
        <div className="admin-page-icon-tile shrink-0">
          <Crown className="size-5" />
        </div>
      }
    >
      <Tabs value={activeTabId} onValueChange={handleTabChange} className="gap-4">
        <AdminTabList className="max-w-full">
          {DISTRIBUTOR_HEAD_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <AdminTabTrigger key={tab.id} value={tab.id} className="gap-2">
                <Icon className="size-4" />
                {tab.label}
              </AdminTabTrigger>
            );
          })}
        </AdminTabList>
      </Tabs>

      {activeTabId === "overview" ? <DistributorHeadOverviewPanel /> : null}
      {activeTabId === "managers" && !entityId ? <DistributorHeadManagersPanel /> : null}
      {activeTabId === "managers" && entityId && managerDetail ? (
        <DistributorHeadManagerDetail manager={managerDetail} />
      ) : null}
      {activeTabId === "managers" && entityId && !managerDetail ? (
        <p className="text-compact text-muted-foreground">Manager not found in demo data.</p>
      ) : null}
      {activeTabId === "distributors" && !entityId ? <DistributorHeadDistributorsPanel /> : null}
      {activeTabId === "distributors" && entityId && distributorDetail ? (
        <DistributorHeadDistributorDetail distributor={distributorDetail} />
      ) : null}
      {activeTabId === "distributors" && entityId && !distributorDetail ? (
        <p className="text-compact text-muted-foreground">Distributor not found in demo data.</p>
      ) : null}
      {activeTabId === "branches" ? <DistributorHeadBranchesPanel /> : null}
      {activeTabId === "sales" ? <DistributorHeadSalesPanel /> : null}
    </AdminSectionPageShell>
  );
}
