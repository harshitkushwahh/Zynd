"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown } from "lucide-react";

import {
  DistributorHeadBranchesPanel,
  DistributorHeadOverviewPanel,
  DistributorHeadSalesPanel,
} from "@/components/distributor-head/distributor-head-tab-panels";
import { DistributorHeadManagersPanel } from "@/components/distributor-head/distributor-head-managers-panel";
import { DistributorHeadDistributorsPanel } from "@/components/distributor-head/distributor-head-distributors-panel";
import { DistributorHeadStateHeadsPanel } from "@/components/distributor-head/distributor-head-state-heads-panel";
import { DistributorHeadManagerView } from "@/components/distributor-head/distributor-head-manager-view";
import { DistributorHeadDistributorView } from "@/components/distributor-head/distributor-head-distributor-view";
import { DistributorPartnerQueuePanel } from "@/components/distributor-head/distributor-partner-queue-panel";
import { DistributorHeadLeaveApplicationsPanel } from "@/components/distributor-head/distributor-head-leave-applications-panel";
import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { DistributorHeadStateBadges } from "@/components/distributor-head/distributor-head-state-badges";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Tabs } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import {
  DISTRIBUTOR_HEAD_HIERARCHY_PERMISSIONS,
  DISTRIBUTOR_HEAD_QUEUE_PERMISSION,
  DISTRIBUTOR_HEAD_TABS,
  distributorHeadTabHref,
  type DistributorHeadTabId,
} from "@/lib/admin-distributor-head-navigation";
import {
  fetchAdminHierarchyManagers,
  fetchAdminHierarchyPartners,
} from "@/lib/admin-distributor-hierarchy-api";
import {
  mapHierarchyManager,
  mapHierarchyPartner,
} from "@/lib/admin-distributor-hierarchy-mappers";
import type {
  DistributorHeadDistributor,
  DistributorHeadManager,
} from "@/lib/dummy/distributor-head-data";
import { isDistributorHeadTabId } from "@/lib/distributor-head-queries";

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
  const { hasPermission, refreshPermissions } = useAdminAuth();
  const canViewQueue = hasPermission(DISTRIBUTOR_HEAD_QUEUE_PERMISSION);
  const canViewHierarchy = DISTRIBUTOR_HEAD_HIERARCHY_PERMISSIONS.some((permission) =>
    hasPermission(permission),
  );
  const canViewMitraConsole = canViewQueue || canViewHierarchy;
  const canView = canViewMitraConsole;
  const tabSlug = segments?.[0];
  const entityId = segments?.[1];
  const listTabId = resolveListTab(segments);
  const managerProfileTabSlug = listTabId === "managers" ? segments?.[2] : undefined;
  const distributorProfileTabSlug = listTabId === "distributors" ? segments?.[2] : undefined;
  const activeTabId = useMemo(() => resolveActiveTabId(segments), [segments]);
  const visibleTabs = useMemo(
    () =>
      DISTRIBUTOR_HEAD_TABS.filter((tab) => {
        if (tab.id === "queue") return canViewQueue;
        return canViewMitraConsole;
      }),
    [canViewMitraConsole, canViewQueue],
  );

  const [managerDetail, setManagerDetail] = useState<DistributorHeadManager | undefined>();
  const [distributorDetail, setDistributorDetail] = useState<DistributorHeadDistributor | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  const loadDetail = useCallback(async () => {
    if (!entityId) {
      setManagerDetail(undefined);
      setDistributorDetail(undefined);
      return;
    }

    if (listTabId === "managers") {
      setDetailLoading(true);
      try {
        const managers = await fetchAdminHierarchyManagers();
        const match = managers.find((row) => row.id === entityId);
        setManagerDetail(match ? mapHierarchyManager(match) : undefined);
        setDistributorDetail(undefined);
      } catch {
        setManagerDetail(undefined);
      } finally {
        setDetailLoading(false);
      }
      return;
    }

    if (listTabId === "distributors") {
      setDetailLoading(true);
      try {
        const partners = await fetchAdminHierarchyPartners();
        const match = partners.find((row) => row.id === entityId);
        setDistributorDetail(match ? mapHierarchyPartner(match) : undefined);
        setManagerDetail(undefined);
      } catch {
        setDistributorDetail(undefined);
      } finally {
        setDetailLoading(false);
      }
      return;
    }

    setManagerDetail(undefined);
    setDistributorDetail(undefined);
  }, [entityId, listTabId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (canViewQueue || activeTabId !== "queue") return;
    router.replace("/dashboard/distributor-head");
  }, [activeTabId, canViewQueue, router]);

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
    if (nextTab.id === "queue" && !canViewQueue) return;
    if (nextTab.id !== "queue" && !canViewMitraConsole) return;
    router.push(distributorHeadTabHref(nextTab));
  };

  const isDetailView = Boolean(managerDetail || distributorDetail);

  const breadcrumbSegments = [
    { label: "Platform" },
    { label: MITRA_HIERARCHY_COPY.superHead, href: "/dashboard/distributor-head" },
  ];
  if (managerDetail) {
    breadcrumbSegments.push(
      { label: MITRA_HIERARCHY_COPY.branchManagers, href: "/dashboard/distributor-head/managers" },
      { label: managerDetail.name },
    );
  } else if (distributorDetail) {
    breadcrumbSegments.push(
      { label: MITRA_HIERARCHY_COPY.zyndMitras, href: "/dashboard/distributor-head/distributors" },
      { label: distributorDetail.name },
    );
  }

  const pageTitle = managerDetail
    ? managerDetail.name
    : distributorDetail
      ? distributorDetail.name
      : MITRA_HIERARCHY_COPY.superHead;

  if (!canView) {
    return (
      <AdminSectionPageShell
        breadcrumbSegments={breadcrumbSegments}
        title={pageTitle}
        headerAside={
          <div className="admin-page-icon-tile shrink-0">
            <Crown className="size-5" />
          </div>
        }
      >
        <AdminFeedbackMessage variant="warning">
          {MITRA_HIERARCHY_COPY.accessDenied}
        </AdminFeedbackMessage>
      </AdminSectionPageShell>
    );
  }

  return (
    <AdminSectionPageShell
      breadcrumbSegments={breadcrumbSegments}
      title={pageTitle}
      titleAddon={isDetailView || !canViewMitraConsole ? undefined : <DistributorHeadStateBadges />}
      headerAside={
        <div className="admin-page-icon-tile shrink-0">
          <Crown className="size-5" />
        </div>
      }
    >
      <Tabs value={activeTabId} onValueChange={handleTabChange} className="gap-4">
        <AdminTabList className="max-w-full">
          {visibleTabs.map((tab) => {
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

      {activeTabId === "overview" && canViewMitraConsole ? <DistributorHeadOverviewPanel /> : null}
      {activeTabId === "state-heads" && canViewMitraConsole ? <DistributorHeadStateHeadsPanel /> : null}
      {activeTabId === "queue" && canViewQueue ? <DistributorPartnerQueuePanel /> : null}
      {activeTabId === "managers" && !entityId && canViewMitraConsole ? (
        <DistributorHeadManagersPanel />
      ) : null}
      {activeTabId === "leave" && canViewMitraConsole ? <DistributorHeadLeaveApplicationsPanel /> : null}
      {activeTabId === "managers" && entityId && managerDetail ? (
        <DistributorHeadManagerView
          manager={managerDetail}
          profileTabSlug={managerProfileTabSlug}
        />
      ) : null}
      {activeTabId === "managers" && entityId && !managerDetail && !detailLoading ? (
        <p className="text-compact text-muted-foreground">{MITRA_HIERARCHY_COPY.managerNotFound}</p>
      ) : null}
      {activeTabId === "distributors" && !entityId && canViewMitraConsole ? (
        <DistributorHeadDistributorsPanel />
      ) : null}
      {activeTabId === "distributors" && entityId && distributorDetail ? (
        <DistributorHeadDistributorView
          distributor={distributorDetail}
          profileTabSlug={distributorProfileTabSlug}
        />
      ) : null}
      {activeTabId === "distributors" && entityId && !distributorDetail && !detailLoading ? (
        <p className="text-compact text-muted-foreground">{MITRA_HIERARCHY_COPY.mitraNotFound}</p>
      ) : null}
      {activeTabId === "branches" && canViewMitraConsole ? <DistributorHeadBranchesPanel /> : null}
      {activeTabId === "sales" && canViewMitraConsole ? <DistributorHeadSalesPanel /> : null}
    </AdminSectionPageShell>
  );
}
