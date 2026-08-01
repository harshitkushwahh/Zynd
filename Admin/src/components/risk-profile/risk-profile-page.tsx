"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Gauge } from "lucide-react";

import { RiskProfileAuditPanel } from "@/components/risk-profile/risk-profile-audit-panel";
import { RiskProfileCategoriesPanel } from "@/components/risk-profile/risk-profile-categories-panel";
import { RiskProfileLockedPanel } from "@/components/risk-profile/risk-profile-locked-panel";
import { RiskProfileQuestionsPanel } from "@/components/risk-profile/risk-profile-questions-panel";
import { RiskProfileTemplatesPanel } from "@/components/risk-profile/risk-profile-templates-panel";
import { RiskProfileTiersPanel } from "@/components/risk-profile/risk-profile-tiers-panel";
import { RiskProfileUsersPanel } from "@/components/risk-profile/risk-profile-users-panel";
import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { Tabs } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
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

export function RiskProfilePage({ tabSlug }: RiskProfilePageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const activeTab = resolveRiskProfileTab(tabSlug);
  const [activeTabId, setActiveTabId] = useState<RiskProfileTabId>(activeTab.id);

  const visibleTabs = useMemo(
    () =>
      RISK_PROFILE_TABS.filter((tab) => {
        if (!tab.permissions?.length) return true;
        return tab.permissions.some((permission) => hasPermission(permission));
      }),
    [hasPermission],
  );

  useEffect(() => {
    if (tabSlug === "bulk") {
      router.replace("/dashboard/risk-profile/questions");
      return;
    }

    const resolved = visibleTabs.find((tab) => tab.id === tabSlug) ?? visibleTabs[0] ?? activeTab;
    setActiveTabId(resolved.id);
    const href = riskProfileTabHref(resolved);
    const currentHref = tabSlug ? `/dashboard/risk-profile/${tabSlug}` : "/dashboard/risk-profile";
    if (href !== currentHref && tabSlug !== resolved.id) {
      router.replace(href);
    }
  }, [activeTab, router, tabSlug, visibleTabs]);

  const handleTabChange = (value: string) => {
    const nextTab = visibleTabs.find((tab) => tab.id === value);
    if (!nextTab) return;
    setActiveTabId(nextTab.id);
    router.push(riskProfileTabHref(nextTab));
  };

  const canManageCategories = hasPermission("risk_profile.categories.manage");
  const canManageQuestions = hasPermission("risk_profile.questions.manage");
  const canManageTemplates = hasPermission("risk_profile.templates.manage");
  const canManageTiers = hasPermission("risk_profile.tiers.manage");
  const canManageLocked = hasPermission("risk_profile.users.manage");

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
                <Icon className="size-4" />
                {tab.label}
              </AdminTabTrigger>
            );
          })}
        </AdminTabList>
      </Tabs>

      {activeTabId === "categories" ? <RiskProfileCategoriesPanel canManage={canManageCategories} /> : null}
      {activeTabId === "questions" ? <RiskProfileQuestionsPanel canManage={canManageQuestions} /> : null}
      {activeTabId === "templates" ? <RiskProfileTemplatesPanel canManage={canManageTemplates} /> : null}
      {activeTabId === "tiers" ? <RiskProfileTiersPanel canManage={canManageTiers} /> : null}
      {activeTabId === "users" ? <RiskProfileUsersPanel /> : null}
      {activeTabId === "locked" ? <RiskProfileLockedPanel canManage={canManageLocked} /> : null}
      {activeTabId === "audit" ? <RiskProfileAuditPanel /> : null}
    </AdminSectionPageShell>
  );
}
