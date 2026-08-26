"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { UsersRound } from "lucide-react";

import { FamilyGroupsAuditPanel } from "@/components/family-groups/family-groups-audit-panel";
import { FamilyGroupsDirectoryPanel } from "@/components/family-groups/family-groups-directory-panel";
import { FamilyGroupsInvitesPanel } from "@/components/family-groups/family-groups-invites-panel";
import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { Tabs } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  FAMILY_GROUPS_TABS,
  familyGroupsTabHref,
  resolveFamilyGroupsTab,
  type FamilyGroupsTabId,
} from "@/lib/admin-family-groups-navigation";

type FamilyGroupsPageProps = {
  tabSlug?: string;
};

export function FamilyGroupsPage({ tabSlug }: FamilyGroupsPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const activeTab = resolveFamilyGroupsTab(tabSlug);
  const [activeTabId, setActiveTabId] = useState<FamilyGroupsTabId>(activeTab.id);

  const visibleTabs = useMemo(
    () =>
      FAMILY_GROUPS_TABS.filter((tab) => {
        if (!tab.permissions?.length) return true;
        return tab.permissions.some((permission) => hasPermission(permission));
      }),
    [hasPermission],
  );

  useEffect(() => {
    const resolved = visibleTabs.find((tab) => tab.id === tabSlug) ?? visibleTabs[0] ?? activeTab;
    setActiveTabId(resolved.id);
    const href = familyGroupsTabHref(resolved);
    const currentHref = tabSlug ? `/dashboard/family-groups/${tabSlug}` : "/dashboard/family-groups";
    if (href !== currentHref && tabSlug !== resolved.id) {
      router.replace(href);
    }
  }, [activeTab, router, tabSlug, visibleTabs]);

  const handleTabChange = (value: string) => {
    const nextTab = visibleTabs.find((tab) => tab.id === value);
    if (!nextTab) return;
    setActiveTabId(nextTab.id);
    router.push(familyGroupsTabHref(nextTab));
  };

  const canManage = hasPermission("family_groups.manage");

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Platform" }, { label: "Family Groups" }]}
      title="Family Groups"
      icon={UsersRound}
    >
      <Tabs value={activeTabId} onValueChange={handleTabChange} className="gap-4">
        <AdminTabList>
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

      {activeTabId === "groups" ? <FamilyGroupsDirectoryPanel canManage={canManage} /> : null}
      {activeTabId === "invites" ? <FamilyGroupsInvitesPanel /> : null}
      {activeTabId === "audit" ? <FamilyGroupsAuditPanel /> : null}
    </AdminSectionPageShell>
  );
}
