"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Gauge, RefreshCw } from "lucide-react";

import {
  RiskProfileCategoriesPanel,
} from "@/components/risk-profile/risk-profile-categories-panel";
import { RiskProfileLockedPanel } from "@/components/risk-profile/risk-profile-locked-panel";
import { RiskProfileQuestionsPanel } from "@/components/risk-profile/risk-profile-questions-panel";
import {
  RiskProfileTemplatesPanel,
} from "@/components/risk-profile/risk-profile-templates-panel";
import { RiskProfileTiersPanel } from "@/components/risk-profile/risk-profile-tiers-panel";
import {
  RISK_PROFILE_USER_TIER_FILTER_OPTIONS,
  RiskProfileUsersPanel,
} from "@/components/risk-profile/risk-profile-users-panel";
import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  RISK_PROFILE_TABS,
  resolveRiskProfileTab,
  riskProfileTabHref,
  type RiskProfileTabId,
} from "@/lib/admin-risk-profile-navigation";

type RiskProfilePageProps = {
  tabSlug?: string;
};

const ALL = "all";

const PANEL_TOOLBAR_TABS: RiskProfileTabId[] = ["categories", "questions", "templates"];

const SEARCH_PLACEHOLDERS: Record<RiskProfileTabId, string> = {
  users: "Search by name, email, or ID",
  locked: "Search by name, email, or ID",
  categories: "Search categories",
  questions: "Search questions",
  templates: "Search templates",
  tiers: "Search tiers",
};

export function RiskProfilePage({ tabSlug }: RiskProfilePageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const { activeTab: activeTabId, selectTab, keepMounted } = useMountedTabs<RiskProfileTabId>(
    resolveRiskProfileTab(tabSlug).id,
    resolveRiskProfileTab(tabSlug).id,
  );

  const [listSearch, setListSearch] = useState("");
  const [tierFilter, setTierFilter] = useState(ALL);
  const [refreshKey, setRefreshKey] = useState(0);

  const showPageToolbar = !PANEL_TOOLBAR_TABS.includes(activeTabId);

  const visibleTabs = useMemo(
    () =>
      RISK_PROFILE_TABS.filter((tab) => {
        if (!tab.permissions?.length) return true;
        return tab.permissions.some((permission) => hasPermission(permission));
      }),
    [hasPermission],
  );

  useEffect(() => {
    if (tabSlug === "bulk" || tabSlug === "audit") {
      router.replace("/dashboard/risk-profile");
      return;
    }

    const urlTab = tabSlug ? visibleTabs.find((tab) => tab.id === tabSlug) : undefined;
    if (!tabSlug || !urlTab) {
      const tab = visibleTabs.find((item) => item.id === activeTabId) ?? visibleTabs[0];
      if (tab) {
        router.replace(riskProfileTabHref(tab), { scroll: false });
      }
    }
  }, [activeTabId, router, tabSlug, visibleTabs]);

  const handleTabChange = (value: string) => {
    const nextTab = visibleTabs.find((tab) => tab.id === value);
    if (!nextTab) return;
    selectTab(nextTab.id);
    router.push(riskProfileTabHref(nextTab));
  };

  const canManageCategories = hasPermission("risk_profile.categories.manage");
  const canManageQuestions = hasPermission("risk_profile.questions.manage");
  const canManageTemplates = hasPermission("risk_profile.templates.manage");
  const canManageTiers = hasPermission("risk_profile.tiers.manage");
  const canManageLocked = hasPermission("risk_profile.users.manage");

  const showRefresh = activeTabId === "users" || activeTabId === "locked";

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Platform" }, { label: "Risk Profile" }]}
      title="Risk Profile"
      icon={Gauge}
    >
      <Tabs value={activeTabId} onValueChange={handleTabChange} className="gap-4">
        <AdminTabList>
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <AdminTabTrigger key={tab.id} value={tab.id} className="gap-2">
                <Icon className="size-4 shrink-0" />
                {tab.label}
              </AdminTabTrigger>
            );
          })}
        </AdminTabList>

        {showPageToolbar ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AdminSearchInput
              containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
              placeholder={SEARCH_PLACEHOLDERS[activeTabId]}
              value={listSearch}
              onChange={(event) => setListSearch(event.target.value)}
            />

            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
              {activeTabId === "users" ? (
                <AdminSelect
                  value={tierFilter}
                  onValueChange={setTierFilter}
                  options={RISK_PROFILE_USER_TIER_FILTER_OPTIONS}
                  placeholder="Tier"
                  className="min-w-select-sm shrink-0"
                  triggerClassName="w-auto"
                />
              ) : null}

              {showRefresh ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setRefreshKey((value) => value + 1)}
                >
                  <RefreshCw className="size-3.5" />
                  Refresh
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <TabsContent value="categories" keepMounted={keepMounted("categories")} className="mt-0">
          <RiskProfileCategoriesPanel
            canManage={canManageCategories}
            search={listSearch}
            onSearchChange={setListSearch}
          />
        </TabsContent>
        <TabsContent value="questions" keepMounted={keepMounted("questions")} className="mt-0">
          <RiskProfileQuestionsPanel
            canManage={canManageQuestions}
            search={listSearch}
            onSearchChange={setListSearch}
          />
        </TabsContent>
        <TabsContent value="templates" keepMounted={keepMounted("templates")} className="mt-0">
          <RiskProfileTemplatesPanel
            canManage={canManageTemplates}
            search={listSearch}
            onSearchChange={setListSearch}
          />
        </TabsContent>
        <TabsContent value="tiers" keepMounted={keepMounted("tiers")} className="mt-0">
          <RiskProfileTiersPanel
            canManage={canManageTiers}
            showToolbar={false}
            search={listSearch}
            onSearchChange={setListSearch}
          />
        </TabsContent>
        <TabsContent value="users" keepMounted={keepMounted("users")} className="mt-0">
          <RiskProfileUsersPanel
            showToolbar={false}
            search={listSearch}
            onSearchChange={setListSearch}
            tierFilter={tierFilter}
            onTierFilterChange={setTierFilter}
            refreshKey={refreshKey}
          />
        </TabsContent>
        <TabsContent value="locked" keepMounted={keepMounted("locked")} className="mt-0">
          <RiskProfileLockedPanel
            canManage={canManageLocked}
            showToolbar={false}
            search={listSearch}
            onSearchChange={setListSearch}
            refreshKey={refreshKey}
          />
        </TabsContent>
      </Tabs>
    </AdminSectionPageShell>
  );
}
