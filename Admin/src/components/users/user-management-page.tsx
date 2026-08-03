"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";

import { AdminKycReviewPanel } from "@/components/admin-kyc-review-panel";
import { AdminAccessOverviewSettingsPanel } from "@/components/settings/admin-access-overview-settings-panel";
import { AdminActionTypesSettingsPanel } from "@/components/settings/admin-action-types-settings-panel";
import { AdminPermissionsSettingsPanel } from "@/components/settings/admin-permissions-settings-panel";
import { AdminRolesSettingsPanel } from "@/components/settings/admin-roles-settings-panel";
import { UserCompliancePanel } from "@/components/users/user-compliance-panel";
import { UsersDirectoryPanel } from "@/components/users/users-directory-panel";
import { AdminPageHeader } from "@/components/dashboard/admin-page-header";
import {
  AdminSectionBreadcrumb,
  userManagementBreadcrumbSegments,
} from "@/components/dashboard/admin-section-breadcrumb";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useAdminUserManagementMetricsQuery } from "@/hooks/use-admin-user-management-metrics-query";
import {
  resolveUserManagementTab,
  userManagementTabHref,
  USER_MANAGEMENT_TABS,
  type UserManagementTabKey,
} from "@/lib/admin-user-management-navigation";

type UserManagementPageProps = {
  tabSlug?: string;
};

export function UserManagementPage({ tabSlug }: UserManagementPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const canReadUsers = hasPermission("users.read");
  const canReadReviews = hasPermission("security_reviews.read");
  const canResolveReviews = hasPermission("security_reviews.resolve");
  const canExecuteDeletions = hasPermission("deletion.execute");
  const canApproveActions = hasPermission("admin_actions.approve");
  const canReadDocuments = hasPermission("documents.read");
  const canManageRbac = hasPermission("rbac.manage");
  const showComplianceMetrics =
    canReadReviews || canExecuteDeletions || canApproveActions;
  const showPageMetrics = canReadUsers || showComplianceMetrics;

  const activeTab = resolveUserManagementTab(tabSlug, hasPermission);
  const [activeTabKey, setActiveTabKey] = useState<UserManagementTabKey>(
    activeTab?.key ?? "people",
  );
  const [mountedTabKeys, setMountedTabKeys] = useState<Set<UserManagementTabKey>>(
    () => new Set([activeTab?.key ?? "people"]),
  );

  const metricsParams = useMemo(
    () => ({
      canReadUsers,
      canReadReviews,
      canExecuteDeletions,
      canApproveActions,
    }),
    [canApproveActions, canExecuteDeletions, canReadReviews, canReadUsers],
  );
  const { data: metrics, isLoading: metricsLoading } =
    useAdminUserManagementMetricsQuery(metricsParams);
  const showMetricsSkeleton = metricsLoading && !metrics;

  const registeredUsers = metrics?.registeredUsers ?? 0;
  const openReviews = metrics?.openReviews ?? 0;
  const pendingDeletions = metrics?.pendingDeletions ?? 0;
  const pendingActions = metrics?.pendingActions ?? 0;

  const visibleTabs = USER_MANAGEMENT_TABS.filter((tab) => {
    if (!tab.permissions?.length) return true;
    if (tab.match === "all") {
      return tab.permissions.every((permission) => hasPermission(permission));
    }
    return tab.permissions.some((permission) => hasPermission(permission));
  });

  useEffect(() => {
    if (!activeTab) return;
    setActiveTabKey(activeTab.key);
    setMountedTabKeys((current) => {
      if (current.has(activeTab.key)) return current;
      return new Set(current).add(activeTab.key);
    });
    const href = userManagementTabHref(activeTab);
    const currentHref = tabSlug ? `/dashboard/users/${tabSlug}` : "/dashboard/users";
    if (href !== currentHref) {
      router.replace(href);
    }
  }, [activeTab, router, tabSlug]);

  const handleTabChange = (value: string) => {
    const nextTab = visibleTabs.find((tab) => tab.key === value);
    if (!nextTab) return;
    setActiveTabKey(nextTab.key);
    setMountedTabKeys((current) => new Set(current).add(nextTab.key));
    router.push(userManagementTabHref(nextTab));
  };

  const keepTabMounted = (key: UserManagementTabKey) => mountedTabKeys.has(key);

  return (
    <div className="admin-section-page-shell">
      <AdminSectionBreadcrumb segments={userManagementBreadcrumbSegments()} />

      <AdminPageHeader title="Users" icon={Users} />

      <div className="admin-section-page-shell__content">
      {showPageMetrics ? (
        <AdminMetricCardsGrid>
          {canReadUsers ? (
            <AdminMetricCard
              label="Registered users"
              value={registeredUsers}
              icon={Users}
              loading={showMetricsSkeleton}
            />
          ) : null}
          {canReadReviews ? (
            <AdminMetricCard
              label="Open security reviews"
              value={openReviews}
              icon={ShieldAlert}
              tone="warning"
              loading={showMetricsSkeleton}
            />
          ) : null}
          {canExecuteDeletions ? (
            <AdminMetricCard
              label="Pending deletions"
              value={pendingDeletions}
              icon={Trash2}
              tone="info"
              loading={showMetricsSkeleton}
            />
          ) : null}
          {canApproveActions ? (
            <AdminMetricCard
              label="Pending approvals"
              value={pendingActions}
              icon={ClipboardList}
              loading={showMetricsSkeleton}
            />
          ) : null}
        </AdminMetricCardsGrid>
      ) : null}

      {!activeTab || visibleTabs.length === 0 ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view user management.
        </AdminFeedbackMessage>
      ) : (
        <Tabs
          value={activeTabKey}
          onValueChange={handleTabChange}
          className="gap-6"
        >
          <AdminTabList>
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <AdminTabTrigger key={tab.key} value={tab.key} className="gap-2">
                  <Icon className="size-4 shrink-0" />
                  {tab.label}
                </AdminTabTrigger>
              );
            })}
          </AdminTabList>

          <div className="min-w-0">
            {canReadUsers ? (
              <TabsContent value="people" className="mt-0" keepMounted={keepTabMounted("people")}>
                <UsersDirectoryPanel />
              </TabsContent>
            ) : null}

            {showComplianceMetrics ? (
              <TabsContent value="compliance" className="mt-0" keepMounted={keepTabMounted("compliance")}>
                <UserCompliancePanel
                  canReadReviews={canReadReviews}
                  canResolveReviews={canResolveReviews}
                  canExecuteDeletions={canExecuteDeletions}
                  canApproveActions={canApproveActions}
                />
              </TabsContent>
            ) : null}

            {canReadDocuments ? (
              <TabsContent value="kyc" className="mt-0" keepMounted={keepTabMounted("kyc")}>
                <AdminKycReviewPanel
                  hasDownload={hasPermission("documents.download")}
                  hasVerify={hasPermission("documents.verify")}
                />
              </TabsContent>
            ) : null}

            {canManageRbac ? (
              <>
                <TabsContent value="roles" className="mt-0" keepMounted={keepTabMounted("roles")}>
                  <AdminRolesSettingsPanel />
                </TabsContent>
                <TabsContent value="permissions" className="mt-0" keepMounted={keepTabMounted("permissions")}>
                  <AdminPermissionsSettingsPanel />
                </TabsContent>
                <TabsContent value="action-types" className="mt-0" keepMounted={keepTabMounted("action-types")}>
                  <AdminActionTypesSettingsPanel />
                </TabsContent>
                <TabsContent value="access-overview" className="mt-0" keepMounted={keepTabMounted("access-overview")}>
                  <AdminAccessOverviewSettingsPanel />
                </TabsContent>
              </>
            ) : null}
          </div>
        </Tabs>
      )}
      </div>
    </div>
  );
}
