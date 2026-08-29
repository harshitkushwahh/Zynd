"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";

import {
  RecommendationBasketsTabPanel,
  RecommendationOpsMetricsSection,
  RecommendationPreviewTabPanel,
  RecommendationPublishTabPanel,
} from "@/components/risk-profile/recommendation-baskets-panel";
import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminMetricCardsSkeleton,
  AdminRecommendationsPageSkeleton,
  AdminTabsSkeleton,
} from "@/components/ui/admin-skeletons";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { useRecommendationConfigQuery } from "@/hooks/use-recommendation-baskets-queries";
import {
  RECOMMENDATIONS_TABS,
  recommendationsTabHref,
  resolveRecommendationsTab,
  type RecommendationsTabId,
} from "@/lib/admin-recommendations-navigation";
import { useQueryClient } from "@tanstack/react-query";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/admin-role-display";

type RecommendationsPageProps = {
  tabSlug?: string;
};

export function RecommendationsPage({ tabSlug }: RecommendationsPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const refreshedQueriesRef = useRef(false);
  const { hasPermission, hasRole } = useAdminAuth();
  const isSuperAdmin = hasRole(SUPER_ADMIN_ROLE_KEY);
  const canRead = hasPermission("recommendations.read") || isSuperAdmin;
  const canManage = hasPermission("recommendations.manage") || isSuperAdmin;
  const canPublish = hasPermission("recommendations.publish") || isSuperAdmin;

  const { activeTab: activeTabId, selectTab, keepMounted } = useMountedTabs<RecommendationsTabId>(
    resolveRecommendationsTab(tabSlug).id,
    resolveRecommendationsTab(tabSlug).id,
  );

  const configQuery = useRecommendationConfigQuery();

  const visibleTabs = useMemo(
    () =>
      RECOMMENDATIONS_TABS.filter((tab) => {
        if (!tab.permissions?.length) return true;
        return tab.permissions.some((permission) => hasPermission(permission)) || isSuperAdmin;
      }),
    [hasPermission, isSuperAdmin],
  );

  useEffect(() => {
    if (refreshedQueriesRef.current || !canRead) return;
    refreshedQueriesRef.current = true;
    void queryClient.invalidateQueries({ queryKey: ["recommendation-config"] });
    void queryClient.invalidateQueries({ queryKey: ["recommendation-publish-readiness"] });
    void queryClient.invalidateQueries({ queryKey: ["recommendation-baskets"] });
    void queryClient.invalidateQueries({ queryKey: ["recommendation-metrics"] });
  }, [canRead, queryClient]);

  useEffect(() => {
    const urlTab = tabSlug ? visibleTabs.find((tab) => tab.id === tabSlug) : undefined;
    if (!tabSlug || !urlTab) {
      const tab = visibleTabs.find((item) => item.id === activeTabId) ?? visibleTabs[0];
      if (tab) {
        router.replace(recommendationsTabHref(tab), { scroll: false });
      }
    }
  }, [activeTabId, router, tabSlug, visibleTabs]);

  const handleTabChange = (value: string) => {
    const nextTab = visibleTabs.find((tab) => tab.id === value);
    if (!nextTab) return;
    selectTab(nextTab.id);
    router.push(recommendationsTabHref(nextTab));
  };

  const showPageSkeleton = canRead && configQuery.isPending && !configQuery.data;

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Recommendation engine" }, { label: "Funds For You" }]}
      title="Funds For You"
      icon={Sparkles}
    >
      {!canRead ? (
        <AdminFeedbackMessage variant="warning">
          Your role can open this page from the sidebar, but you need the{" "}
          <span className="font-medium">View recommendation baskets</span> permission to load
          baskets and publish config. Ask a super admin to update your role.
        </AdminFeedbackMessage>
      ) : showPageSkeleton ? (
        <div className="space-y-4">
          {canPublish ? <AdminMetricCardsSkeleton count={4} /> : null}
          <AdminTabsSkeleton count={visibleTabs.length} />
          <AdminRecommendationsPageSkeleton tab={activeTabId} />
        </div>
      ) : (
        <div className="space-y-4">
          <RecommendationOpsMetricsSection canPublish={canPublish} />
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

          <TabsContent value="baskets" keepMounted={keepMounted("baskets")} className="mt-0">
            <RecommendationBasketsTabPanel canManage={canManage} />
          </TabsContent>
          <TabsContent value="publish" keepMounted={keepMounted("publish")} className="mt-0">
            <RecommendationPublishTabPanel canPublish={canPublish} />
          </TabsContent>
          <TabsContent value="preview" keepMounted={keepMounted("preview")} className="mt-0">
            <RecommendationPreviewTabPanel />
          </TabsContent>
        </Tabs>
        </div>
      )}
    </AdminSectionPageShell>
  );
}
