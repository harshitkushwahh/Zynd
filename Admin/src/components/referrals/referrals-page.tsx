"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Gift } from "lucide-react";

import { ReferralsDirectoryPanel } from "@/components/referrals/referrals-directory-panel";
import { ReferralsLeaderboardPanel } from "@/components/referrals/referrals-leaderboard-panel";
import { ReferralsRedemptionHistoryPanel } from "@/components/referrals/referrals-redemption-history-panel";
import { ReferralsReferrersPanel } from "@/components/referrals/referrals-referrers-panel";
import { ReferralsRewardCategoriesPanel } from "@/components/referrals/referrals-reward-categories-panel";
import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { Tabs } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  REFERRALS_TABS,
  referralsTabHref,
  resolveReferralsTab,
  type ReferralsTabId,
} from "@/lib/admin-referrals-navigation";

type ReferralsPageProps = {
  tabSlug?: string;
};

export function ReferralsPage({ tabSlug }: ReferralsPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const activeTab = resolveReferralsTab(tabSlug);
  const [activeTabId, setActiveTabId] = useState<ReferralsTabId>(activeTab.id);

  const visibleTabs = useMemo(
    () =>
      REFERRALS_TABS.filter((tab) => {
        if (!tab.permissions?.length) return true;
        return tab.permissions.some((permission) => hasPermission(permission));
      }),
    [hasPermission],
  );

  useEffect(() => {
    const resolved = visibleTabs.find((tab) => tab.id === tabSlug) ?? visibleTabs[0] ?? activeTab;
    setActiveTabId(resolved.id);
    const href = referralsTabHref(resolved);
    const currentHref = tabSlug ? `/dashboard/referrals/${tabSlug}` : "/dashboard/referrals";
    if (href !== currentHref && tabSlug !== resolved.id) {
      router.replace(href);
    }
  }, [activeTab, router, tabSlug, visibleTabs]);

  const handleTabChange = (value: string) => {
    const nextTab = visibleTabs.find((tab) => tab.id === value);
    if (!nextTab) return;
    setActiveTabId(nextTab.id);
    router.push(referralsTabHref(nextTab));
  };

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Platform" }, { label: "Referrals" }]}
      title="Referrals"
      icon={Gift}
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

      {activeTabId === "overview" ? <ReferralsReferrersPanel /> : null}
      {activeTabId === "directory" ? <ReferralsDirectoryPanel /> : null}
      {activeTabId === "leaderboard" ? <ReferralsLeaderboardPanel /> : null}
      {activeTabId === "redemptions" ? <ReferralsRedemptionHistoryPanel /> : null}
      {activeTabId === "rewards" ? <ReferralsRewardCategoriesPanel /> : null}
    </AdminSectionPageShell>
  );
}
