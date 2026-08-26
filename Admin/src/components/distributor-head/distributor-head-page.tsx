"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown } from "lucide-react";

import {
  DistributorHeadBranchesPanel,
  DistributorHeadOverviewPanel,
  DistributorHeadSalesPanel,
} from "@/components/distributor-head/distributor-head-tab-panels";
import { DistributorHeadManagersPanel } from "@/components/distributor-head/distributor-head-managers-panel";
import { DistributorHeadDistributorsPanel } from "@/components/distributor-head/distributor-head-distributors-panel";
import { DistributorHeadStateHeadsPanel } from "@/components/distributor-head/distributor-head-state-heads-panel";
import { DistributorHeadStateHeadView, DistributorHeadStateHeadDetailSkeleton } from "@/components/distributor-head/distributor-head-state-head-view";
import { DistributorHeadBranchView, DistributorHeadBranchDetailSkeleton } from "@/components/distributor-head/distributor-head-branch-view";
import { DistributorHeadManagerView, DistributorHeadManagerDetailSkeleton } from "@/components/distributor-head/distributor-head-manager-view";
import { DistributorHeadDistributorView } from "@/components/distributor-head/distributor-head-distributor-view";
import { DistributorPartnerQueuePanel } from "@/components/distributor-head/distributor-partner-queue-panel";
import { DistributorHeadLeaveApplicationsPanel } from "@/components/distributor-head/distributor-head-leave-applications-panel";
import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { DistributorHeadStateBadges } from "@/components/distributor-head/distributor-head-state-badges";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import {
  isMitraStateHeadOnly,
  resolveMitraConsoleTitle,
  resolveMitraHierarchyPersona,
} from "@/lib/admin-mitra-roles";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import { matchesUserRef, pickUserRef, userRefToPath } from "@/lib/admin-user-ref";
import {
  DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION,
  DISTRIBUTOR_HEAD_HIERARCHY_PERMISSIONS,
  DISTRIBUTOR_HEAD_QUEUE_PERMISSION,
  DISTRIBUTOR_HEAD_TABS,
  distributorHeadTabHref,
  type DistributorHeadTabId,
} from "@/lib/admin-distributor-head-navigation";
import {
  fetchAdminHierarchyBranch,
  fetchAdminHierarchyManagers,
  fetchAdminHierarchyOverview,
  fetchAdminHierarchyPartners,
  fetchAdminHierarchyStateHeads,
  type AdminHierarchyBranchDetail,
  type AdminHierarchyStateHead,
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

/** Survives catch-all remounts so tab/detail navigations do not flash a skeleton. */
const stateHeadDetailCache = new Map<string, AdminHierarchyStateHead>();
const branchDetailCache = new Map<string, AdminHierarchyBranchDetail>();
const managerDetailCache = new Map<string, DistributorHeadManager>();

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
  const { hasPermission, refreshPermissions, roleKeys } = useAdminAuth();
  const mitraPersona = resolveMitraHierarchyPersona(roleKeys);
  const mitraConsoleTitle = resolveMitraConsoleTitle(roleKeys);
  const isStateHeadOnly = isMitraStateHeadOnly(roleKeys);
  const canViewQueue = hasPermission(DISTRIBUTOR_HEAD_QUEUE_PERMISSION);
  const canViewHierarchy = DISTRIBUTOR_HEAD_HIERARCHY_PERMISSIONS.some((permission) =>
    hasPermission(permission),
  );
  const canViewMitraConsole = canViewQueue || canViewHierarchy;
  const canView = canViewMitraConsole;
  const canManageStateHeads = hasPermission(DISTRIBUTOR_HEAD_BRANCHES_MANAGE_PERMISSION);
  const tabSlug = segments?.[0];
  const entityId = segments?.[1];
  const listTabId = resolveListTab(segments);
  const managerProfileTabSlug = listTabId === "managers" ? segments?.[2] : undefined;
  const distributorProfileTabSlug = listTabId === "distributors" ? segments?.[2] : undefined;
  const stateHeadProfileTabSlug = listTabId === "state-heads" ? segments?.[2] : undefined;
  const branchProfileTabSlug = listTabId === "branches" ? segments?.[2] : undefined;
  const activeTabId = useMemo(() => resolveActiveTabId(segments), [segments]);
  const visibleTabs = useMemo(
    () =>
      DISTRIBUTOR_HEAD_TABS.filter((tab) => {
        if (tab.id === "state-heads") return canViewMitraConsole && !isStateHeadOnly;
        if (tab.id === "queue") return canViewQueue;
        return canViewMitraConsole;
      }),
    [canViewMitraConsole, canViewQueue, isStateHeadOnly],
  );

  const [managerDetail, setManagerDetail] = useState<DistributorHeadManager | undefined>(() => {
    if (listTabId !== "managers" || !entityId) return undefined;
    return managerDetailCache.get(entityId);
  });
  const [distributorDetail, setDistributorDetail] = useState<DistributorHeadDistributor | undefined>();
  const [stateHeadDetail, setStateHeadDetail] = useState<AdminHierarchyStateHead | undefined>(() => {
    if (listTabId !== "state-heads" || !entityId) return undefined;
    return stateHeadDetailCache.get(entityId);
  });
  const [branchDetail, setBranchDetail] = useState<AdminHierarchyBranchDetail | undefined>(() => {
    if (listTabId !== "branches" || !entityId) return undefined;
    return branchDetailCache.get(entityId);
  });
  const [detailLoading, setDetailLoading] = useState(false);
  const [stateAssignmentMissing, setStateAssignmentMissing] = useState(false);
  const loadedStateHeadIdRef = useRef<string | null>(
    stateHeadDetail ? userRefToPath(pickUserRef(stateHeadDetail)) : null,
  );
  const loadedBranchIdRef = useRef<string | null>(branchDetail?.id ?? null);
  const loadedManagerIdRef = useRef<string | null>(managerDetail?.id ?? null);

  useEffect(() => {
    loadedStateHeadIdRef.current = stateHeadDetail
      ? userRefToPath(pickUserRef(stateHeadDetail))
      : null;
  }, [stateHeadDetail]);

  useEffect(() => {
    loadedBranchIdRef.current = branchDetail?.id ?? null;
  }, [branchDetail?.id]);

  useEffect(() => {
    loadedManagerIdRef.current = managerDetail?.id ?? null;
  }, [managerDetail?.id]);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  useEffect(() => {
    if (!isStateHeadOnly) {
      setStateAssignmentMissing(false);
      return;
    }

    void fetchAdminHierarchyOverview()
      .then((overview) => setStateAssignmentMissing(overview.state_assigned === false))
      .catch(() => setStateAssignmentMissing(false));
  }, [isStateHeadOnly]);

  const loadDetail = useCallback(async () => {
    if (!entityId) {
      setManagerDetail(undefined);
      setDistributorDetail(undefined);
      setStateHeadDetail(undefined);
      setBranchDetail(undefined);
      loadedStateHeadIdRef.current = null;
      loadedBranchIdRef.current = null;
      return;
    }

    if (listTabId === "managers") {
      const cached = managerDetailCache.get(entityId);
      if (cached || loadedManagerIdRef.current === entityId) {
        if (cached) {
          setManagerDetail(cached);
          loadedManagerIdRef.current = cached.id;
        }
        setDistributorDetail(undefined);
        setStateHeadDetail(undefined);
        setBranchDetail(undefined);
        loadedStateHeadIdRef.current = null;
        loadedBranchIdRef.current = null;
        return;
      }
      setManagerDetail(undefined);
      loadedManagerIdRef.current = null;
      setDetailLoading(true);
      try {
        const managers = await fetchAdminHierarchyManagers();
        const match = managers.find((row) => row.id === entityId);
        const mapped = match ? mapHierarchyManager(match) : undefined;
        if (mapped) {
          managerDetailCache.set(entityId, mapped);
          loadedManagerIdRef.current = mapped.id;
        } else {
          managerDetailCache.delete(entityId);
        }
        setManagerDetail(mapped);
        setDistributorDetail(undefined);
        setStateHeadDetail(undefined);
        setBranchDetail(undefined);
        loadedStateHeadIdRef.current = null;
        loadedBranchIdRef.current = null;
      } catch {
        setManagerDetail(undefined);
        loadedManagerIdRef.current = null;
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
        setStateHeadDetail(undefined);
        setBranchDetail(undefined);
        loadedStateHeadIdRef.current = null;
        loadedBranchIdRef.current = null;
      } catch {
        setDistributorDetail(undefined);
      } finally {
        setDetailLoading(false);
      }
      return;
    }

    if (listTabId === "branches") {
      const cached = branchDetailCache.get(entityId);
      if (cached || loadedBranchIdRef.current === entityId) {
        if (cached) {
          setBranchDetail(cached);
          loadedBranchIdRef.current = cached.id;
        }
        setManagerDetail(undefined);
        setDistributorDetail(undefined);
        setStateHeadDetail(undefined);
        loadedStateHeadIdRef.current = null;
        return;
      }
      setBranchDetail(undefined);
      loadedBranchIdRef.current = null;
      setDetailLoading(true);
      try {
        const match = await fetchAdminHierarchyBranch(entityId);
        branchDetailCache.set(entityId, match);
        setBranchDetail(match);
        loadedBranchIdRef.current = match.id;
        setManagerDetail(undefined);
        setDistributorDetail(undefined);
        setStateHeadDetail(undefined);
        loadedStateHeadIdRef.current = null;
      } catch {
        setBranchDetail(undefined);
        loadedBranchIdRef.current = null;
      } finally {
        setDetailLoading(false);
      }
      return;
    }

    if (listTabId === "state-heads") {
      const cached = stateHeadDetailCache.get(entityId);
      if (cached || loadedStateHeadIdRef.current === entityId) {
        if (cached) {
          setStateHeadDetail(cached);
          loadedStateHeadIdRef.current = userRefToPath(pickUserRef(cached));
        }
        setManagerDetail(undefined);
        setDistributorDetail(undefined);
        setBranchDetail(undefined);
        loadedBranchIdRef.current = null;
        return;
      }
      setStateHeadDetail(undefined);
      loadedStateHeadIdRef.current = null;
      setDetailLoading(true);
      try {
        const stateHeads = await fetchAdminHierarchyStateHeads();
        const match = stateHeads.find((row) => matchesUserRef(entityId, row));
        if (match) {
          const cacheKey = userRefToPath(pickUserRef(match));
          stateHeadDetailCache.set(cacheKey, match);
        } else {
          stateHeadDetailCache.delete(entityId);
        }
        setStateHeadDetail(match);
        loadedStateHeadIdRef.current = match ? userRefToPath(pickUserRef(match)) : null;
        setManagerDetail(undefined);
        setDistributorDetail(undefined);
        setBranchDetail(undefined);
        loadedBranchIdRef.current = null;
      } catch {
        setStateHeadDetail(undefined);
        loadedStateHeadIdRef.current = null;
      } finally {
        setDetailLoading(false);
      }
      return;
    }

    setManagerDetail(undefined);
    setDistributorDetail(undefined);
    setStateHeadDetail(undefined);
    setBranchDetail(undefined);
    loadedStateHeadIdRef.current = null;
    loadedBranchIdRef.current = null;
  }, [entityId, listTabId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!isStateHeadOnly || activeTabId !== "state-heads") return;
    router.replace("/dashboard/distributor-head");
  }, [activeTabId, isStateHeadOnly, router]);

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

  const isStateHeadDetailRoute = listTabId === "state-heads" && Boolean(entityId);
  const isBranchDetailRoute = listTabId === "branches" && Boolean(entityId);
  const isManagerDetailRoute = listTabId === "managers" && Boolean(entityId);
  const isConsoleShell =
    !isStateHeadDetailRoute && !isBranchDetailRoute && !isManagerDetailRoute;
  const { activeTab: consoleTab, selectTab: selectConsoleTab, keepMounted } = useMountedTabs<DistributorHeadTabId>(
    "overview",
    isConsoleShell ? listTabId : undefined,
  );
  const isDetailView = Boolean(managerDetail || distributorDetail || stateHeadDetail || branchDetail);

  const handleTabChange = (value: string | number | null) => {
    if (value == null || typeof value !== "string") return;
    const nextTab = DISTRIBUTOR_HEAD_TABS.find((tab) => tab.id === value);
    if (!nextTab) return;
    if (nextTab.id === "queue" && !canViewQueue) return;
    if (nextTab.id !== "queue" && !canViewMitraConsole) return;
    if (entityId) {
      router.push(distributorHeadTabHref(nextTab));
      return;
    }
    selectConsoleTab(nextTab.id);
    window.history.replaceState(window.history.state, "", distributorHeadTabHref(nextTab));
  };

  const breadcrumbSegments = [
    { label: "Platform" },
    { label: mitraConsoleTitle, href: "/dashboard/distributor-head" },
  ];
  if (isStateHeadDetailRoute || stateHeadDetail) {
    breadcrumbSegments.push(
      {
        label: `${MITRA_HIERARCHY_COPY.stateHead}s`,
        href: "/dashboard/distributor-head/state-heads",
      },
      { label: stateHeadDetail?.name ?? "…" },
    );
  } else if (isBranchDetailRoute || branchDetail) {
    breadcrumbSegments.push(
      { label: "Branches", href: "/dashboard/distributor-head/branches" },
      { label: branchDetail?.name ?? "…" },
    );
  } else if (managerDetail) {
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

  const pageTitle = isStateHeadDetailRoute || isBranchDetailRoute || isManagerDetailRoute
    ? mitraConsoleTitle
    : managerDetail
      ? managerDetail.name
      : distributorDetail
        ? distributorDetail.name
        : branchDetail
          ? branchDetail.name
          : mitraConsoleTitle;

  if (!canView) {
    return (
      <AdminSectionPageShell
        breadcrumbSegments={breadcrumbSegments}
        title={pageTitle}
        icon={Crown}
      >
        <AdminFeedbackMessage variant="warning" dismissible={false}>
          {MITRA_HIERARCHY_COPY.accessDenied}
        </AdminFeedbackMessage>
      </AdminSectionPageShell>
    );
  }

  return (
    <AdminSectionPageShell
      breadcrumbSegments={breadcrumbSegments}
      title={pageTitle}
      icon={Crown}
      hideBreadcrumb={isStateHeadDetailRoute || isBranchDetailRoute || isManagerDetailRoute}
      hideHeader={isStateHeadDetailRoute || isBranchDetailRoute || isManagerDetailRoute}
      titleAddon={
        isDetailView ||
        isStateHeadDetailRoute ||
        isBranchDetailRoute ||
        isManagerDetailRoute ||
        !canViewMitraConsole
          ? undefined
          : <DistributorHeadStateBadges persona={mitraPersona} />
      }
    >
      {isConsoleShell ? (
        <Tabs value={consoleTab} onValueChange={handleTabChange} className="gap-4">
          {stateAssignmentMissing ? (
            <AdminFeedbackMessage variant="warning">
              No state assigned yet. Ask your Mitra Super Head to link you on the State Heads tab.
            </AdminFeedbackMessage>
          ) : null}
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

          {canViewMitraConsole ? (
            <TabsContent
              value="overview"
              keepMounted={keepMounted("overview")}
              className="distributor-head-console__panel mt-0"
            >
              <DistributorHeadOverviewPanel persona={mitraPersona} />
            </TabsContent>
          ) : null}

          {canViewMitraConsole && !isStateHeadOnly ? (
            <TabsContent
              value="state-heads"
              keepMounted={keepMounted("state-heads")}
              className="distributor-head-console__panel mt-0"
            >
              <DistributorHeadStateHeadsPanel />
            </TabsContent>
          ) : null}

          {canViewQueue ? (
            <TabsContent
              value="queue"
              keepMounted={keepMounted("queue")}
              className="distributor-head-console__panel mt-0"
            >
              <DistributorPartnerQueuePanel />
            </TabsContent>
          ) : null}

          {canViewMitraConsole ? (
            <TabsContent
              value="managers"
              keepMounted={keepMounted("managers")}
              className="distributor-head-console__panel mt-0"
            >
              <DistributorHeadManagersPanel />
            </TabsContent>
          ) : null}

          {canViewMitraConsole ? (
            <TabsContent
              value="leave"
              keepMounted={keepMounted("leave")}
              className="distributor-head-console__panel mt-0"
            >
              <DistributorHeadLeaveApplicationsPanel />
            </TabsContent>
          ) : null}

          {canViewMitraConsole ? (
            <TabsContent
              value="distributors"
              keepMounted={keepMounted("distributors")}
              className="distributor-head-console__panel mt-0"
            >
              {!entityId || listTabId !== "distributors" ? (
                <DistributorHeadDistributorsPanel />
              ) : distributorDetail ? (
                <DistributorHeadDistributorView
                  distributor={distributorDetail}
                  profileTabSlug={distributorProfileTabSlug}
                />
              ) : !detailLoading ? (
                <p className="text-compact text-muted-foreground">{MITRA_HIERARCHY_COPY.mitraNotFound}</p>
              ) : null}
            </TabsContent>
          ) : null}

          {canViewMitraConsole ? (
            <TabsContent
              value="branches"
              keepMounted={keepMounted("branches")}
              className="distributor-head-console__panel mt-0"
            >
              <DistributorHeadBranchesPanel />
            </TabsContent>
          ) : null}

          {canViewMitraConsole ? (
            <TabsContent
              value="sales"
              keepMounted={keepMounted("sales")}
              className="distributor-head-console__panel mt-0"
            >
              <DistributorHeadSalesPanel />
            </TabsContent>
          ) : null}
        </Tabs>
      ) : null}

      {isManagerDetailRoute && entityId && managerDetail ? (
        <DistributorHeadManagerView
          manager={managerDetail}
          profileTabSlug={managerProfileTabSlug}
          breadcrumbSegments={breadcrumbSegments}
        />
      ) : null}
      {isManagerDetailRoute && entityId && detailLoading && !managerDetail ? (
        <DistributorHeadManagerDetailSkeleton breadcrumbSegments={breadcrumbSegments} />
      ) : null}
      {isManagerDetailRoute && entityId && !managerDetail && !detailLoading ? (
        <p className="text-compact text-muted-foreground">{MITRA_HIERARCHY_COPY.managerNotFound}</p>
      ) : null}

      {isStateHeadDetailRoute && entityId && stateHeadDetail ? (
        <DistributorHeadStateHeadView
          stateHead={stateHeadDetail}
          profileTabSlug={stateHeadProfileTabSlug}
          breadcrumbSegments={breadcrumbSegments}
          canManage={canManageStateHeads}
          onUpdated={(next) => {
            const previousKey = userRefToPath(pickUserRef(stateHeadDetail));
            const nextKey = userRefToPath(pickUserRef(next));
            stateHeadDetailCache.delete(previousKey);
            stateHeadDetailCache.set(nextKey, next);
            loadedStateHeadIdRef.current = nextKey;
            setStateHeadDetail(next);
          }}
          onUnassigned={() => {
            stateHeadDetailCache.delete(userRefToPath(pickUserRef(stateHeadDetail)));
            loadedStateHeadIdRef.current = null;
            setStateHeadDetail(undefined);
          }}
        />
      ) : null}
      {isStateHeadDetailRoute && entityId && detailLoading && !stateHeadDetail ? (
        <DistributorHeadStateHeadDetailSkeleton breadcrumbSegments={breadcrumbSegments} />
      ) : null}
      {isStateHeadDetailRoute && entityId && !stateHeadDetail && !detailLoading ? (
        <p className="text-compact text-muted-foreground">{MITRA_HIERARCHY_COPY.stateHeadNotFound}</p>
      ) : null}
      {isBranchDetailRoute && entityId && branchDetail ? (
        <DistributorHeadBranchView
          branch={branchDetail}
          profileTabSlug={branchProfileTabSlug}
          breadcrumbSegments={breadcrumbSegments}
          onUpdated={(next) => {
            branchDetailCache.set(next.id, next);
            loadedBranchIdRef.current = next.id;
            setBranchDetail(next);
          }}
        />
      ) : null}
      {isBranchDetailRoute && entityId && detailLoading && !branchDetail ? (
        <DistributorHeadBranchDetailSkeleton breadcrumbSegments={breadcrumbSegments} />
      ) : null}
      {isBranchDetailRoute && entityId && !branchDetail && !detailLoading ? (
        <p className="text-compact text-muted-foreground">Branch not found.</p>
      ) : null}
    </AdminSectionPageShell>
  );
}
