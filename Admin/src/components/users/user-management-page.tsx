"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, TrendingUp, UserX, Users } from "lucide-react";

import { AdminAccessOverviewSettingsPanel } from "@/components/settings/admin-access-overview-settings-panel";
import { AdminActionTypesSettingsPanel } from "@/components/settings/admin-action-types-settings-panel";
import { AdminPermissionsSettingsPanel } from "@/components/settings/admin-permissions-settings-panel";
import { AdminRolesSettingsPanel } from "@/components/settings/admin-roles-settings-panel";
import { AdminTeamWorkspacePanel } from "@/components/users/admin-team-workspace-panel";
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
  teamWorkspaceSubTabHref,
  userManagementTabHref,
  USER_MANAGEMENT_TABS,
  type TeamWorkspaceSubTabKey,
  type UserManagementTabKey,
} from "@/lib/admin-user-management-navigation";

type UserManagementPageProps = {
  tabSlug?: string;
  teamSubTab?: TeamWorkspaceSubTabKey;
};

export function UserManagementPage({ tabSlug, teamSubTab = "members" }: UserManagementPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const canReadUsers = hasPermission("users.read");
  const canManageRbac = hasPermission("rbac.manage");
  const showPageMetrics = canReadUsers;

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
    }),
    [canReadUsers],
  );
  const { data: metrics, isLoading: metricsLoading } =
    useAdminUserManagementMetricsQuery(metricsParams);
  const showMetricsSkeleton = metricsLoading && !metrics;

  const registeredUsers = metrics?.registeredUsers ?? 0;
  const kycCompliant = metrics?.kycCompliant ?? 0;
  const suspendedAccounts = metrics?.suspendedAccounts ?? 0;
  const activeInvestors = metrics?.activeInvestors ?? 0;

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

  const handleTeamSubTabChange = (subTab: TeamWorkspaceSubTabKey) => {
    router.push(teamWorkspaceSubTabHref(subTab));
  };

  return (
    <div className="admin-section-page-shell">
      <AdminSectionBreadcrumb segments={userManagementBreadcrumbSegments()} />

      <AdminPageHeader title="Users" icon={Users} />

      <div className="admin-section-page-shell__content">
      {showPageMetrics ? (
        <AdminMetricCardsGrid columns="four">
          <AdminMetricCard
            label="Registered users"
            value={registeredUsers}
            icon={Users}
            loading={showMetricsSkeleton}
          />
          <AdminMetricCard
            label="KYC compliant"
            value={kycCompliant}
            icon={ShieldCheck}
            tone="success"
            loading={showMetricsSkeleton}
          />
          <AdminMetricCard
            label="Suspended accounts"
            value={suspendedAccounts}
            icon={UserX}
            tone={suspendedAccounts > 0 ? "warning" : "muted"}
            loading={showMetricsSkeleton}
          />
          <AdminMetricCard
            label="Active investors"
            value={activeInvestors}
            icon={TrendingUp}
            tone="info"
            loading={showMetricsSkeleton}
          />
        </AdminMetricCardsGrid>
      ) : null}

      {!activeTab || visibleTabs.length === 0 ? (
        <AdminFeedbackMessage variant="warning" dismissible={false}>
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

            {canManageRbac ? (
              <>
                <TabsContent value="team" className="mt-0" keepMounted={keepTabMounted("team")}>
                  <AdminTeamWorkspacePanel
                    activeSubTab={teamSubTab}
                    onSubTabChange={handleTeamSubTabChange}
                  />
                </TabsContent>
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
