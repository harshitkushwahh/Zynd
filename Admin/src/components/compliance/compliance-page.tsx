"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import {
  ClipboardList,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { AdminKycReviewPanel } from "@/components/admin-kyc-review-panel";
import { AdminAccountsPanel } from "@/components/compliance/admin-accounts-panel";
import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  ComplianceTabCount,
  UserCompliancePanel,
} from "@/components/users/user-compliance-panel";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useAdminAdminAccountsQuery } from "@/hooks/use-admin-admin-accounts-query";
import { useAdminComplianceQuery } from "@/hooks/use-admin-compliance-query";
import {
  COMPLIANCE_TABS,
  complianceTabHref,
  resolveComplianceTab,
  type ComplianceTabKey,
} from "@/lib/admin-compliance-navigation";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/admin-role-display";

type CompliancePageProps = {
  tabSlug?: string;
};

export function CompliancePage({ tabSlug }: CompliancePageProps) {
  const router = useRouter();
  const { hasPermission, hasRole } = useAdminAuth();
  const canReadReviews = hasPermission("security_reviews.read");
  const canResolveReviews = hasPermission("security_reviews.resolve");
  const canExecuteDeletions = hasPermission("deletion.execute");
  const canApproveActions = hasPermission("admin_actions.approve");
  const canReadDocuments = hasPermission("documents.read");
  const canManageAdminAccounts =
    hasRole(SUPER_ADMIN_ROLE_KEY) && hasPermission("admin.accounts.manage");
  const isSuperAdmin = hasRole(SUPER_ADMIN_ROLE_KEY);

  const activeTab = resolveComplianceTab(tabSlug, hasPermission, hasRole);
  const resolvedTabKey = activeTab?.key ?? "security-reviews";
  const { activeTab: activeTabKey, selectTab, keepMounted } = useMountedTabs<ComplianceTabKey>(
    resolvedTabKey,
    activeTab?.key,
  );

  const complianceParams = useMemo(
    () => ({
      canReadReviews,
      canExecuteDeletions,
      canApproveActions,
      canReadDocuments,
    }),
    [canApproveActions, canExecuteDeletions, canReadDocuments, canReadReviews],
  );
  const { data: complianceData, isLoading: complianceLoading } =
    useAdminComplianceQuery(complianceParams);
  const { data: adminAccounts = [] } = useAdminAdminAccountsQuery(canManageAdminAccounts);

  const reviewCount = complianceData?.reviews.length ?? 0;
  const deletionCount = complianceData?.deletions.length ?? 0;
  const actionCount = complianceData?.pendingActions.length ?? 0;
  const kycReviewCount = complianceData?.pendingKycReviews ?? 0;
  const adminOnHoldCount = adminAccounts.filter((account) => account.status === "suspended").length;
  const showMetrics =
    canReadReviews || canExecuteDeletions || canApproveActions || canReadDocuments;

  const visibleTabs = COMPLIANCE_TABS.filter((tab) => {
    if (tab.superAdminOnly && !isSuperAdmin) return false;
    if (!tab.permissions?.length) return true;
    return tab.permissions.some((permission) => hasPermission(permission));
  });

  useEffect(() => {
    if (!activeTab) return;
    const href = complianceTabHref(activeTab);
    const currentHref = tabSlug ? `/dashboard/compliance/${tabSlug}` : "/dashboard/compliance";
    if (href !== currentHref) {
      router.replace(href);
    }
  }, [activeTab, router, tabSlug]);

  const handleTabChange = (value: string) => {
    const nextTab = visibleTabs.find((tab) => tab.key === value);
    if (!nextTab) return;
    selectTab(nextTab.key);
    router.push(complianceTabHref(nextTab));
  };

  const tabCounts: Partial<Record<ComplianceTabKey, number>> = {
    "security-reviews": reviewCount,
    "account-deletions": deletionCount,
    "admin-actions": actionCount,
    "admin-accounts": adminOnHoldCount,
  };

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Compliance" }]}
      title="Compliance"
      icon={ShieldCheck}
    >
      {showMetrics ? (
        <AdminMetricCardsGrid columns="four">
          <AdminMetricCard
            label="Open security reviews"
            value={reviewCount}
            icon={ShieldAlert}
            tone="warning"
            loading={complianceLoading && !complianceData}
          />
          <AdminMetricCard
            label="Pending deletions"
            value={deletionCount}
            icon={Trash2}
            tone="info"
            loading={complianceLoading && !complianceData}
          />
          <AdminMetricCard
            label="Pending approvals"
            value={actionCount}
            icon={ClipboardList}
            loading={complianceLoading && !complianceData}
          />
          <AdminMetricCard
            label="Pending KYC reviews"
            value={kycReviewCount}
            icon={FileCheck2}
            tone={kycReviewCount > 0 ? "warning" : "muted"}
            loading={complianceLoading && !complianceData}
          />
        </AdminMetricCardsGrid>
      ) : null}

      {!activeTab || visibleTabs.length === 0 ? (
        <AdminFeedbackMessage variant="warning" dismissible={false}>
          You do not have permission to view compliance queues.
        </AdminFeedbackMessage>
      ) : (
        <Tabs value={activeTabKey} onValueChange={handleTabChange} className="gap-6">
          <AdminTabList>
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const count = tab.showCount ? tabCounts[tab.key] ?? 0 : null;
              return (
                <AdminTabTrigger key={tab.key} value={tab.key} className="gap-2">
                  <Icon className="size-4 shrink-0" />
                  {tab.label}
                  {count != null ? (
                    <ComplianceTabCount count={count} active={activeTabKey === tab.key} />
                  ) : null}
                </AdminTabTrigger>
              );
            })}
          </AdminTabList>

          <div className="min-w-0">
            {canReadReviews ? (
              <TabsContent
                value="security-reviews"
                keepMounted={keepMounted("security-reviews")}
                className="mt-0"
              >
                <UserCompliancePanel
                  canReadReviews={canReadReviews}
                  canResolveReviews={canResolveReviews}
                  canExecuteDeletions={false}
                  canApproveActions={false}
                  activeTab="reviews"
                  showTabBar={false}
                />
              </TabsContent>
            ) : null}

            {canExecuteDeletions ? (
              <TabsContent
                value="account-deletions"
                keepMounted={keepMounted("account-deletions")}
                className="mt-0"
              >
                <UserCompliancePanel
                  canReadReviews={false}
                  canResolveReviews={false}
                  canExecuteDeletions={canExecuteDeletions}
                  canApproveActions={false}
                  activeTab="deletions"
                  showTabBar={false}
                />
              </TabsContent>
            ) : null}

            {canApproveActions ? (
              <TabsContent
                value="admin-actions"
                keepMounted={keepMounted("admin-actions")}
                className="mt-0"
              >
                <UserCompliancePanel
                  canReadReviews={false}
                  canResolveReviews={false}
                  canExecuteDeletions={false}
                  canApproveActions={canApproveActions}
                  activeTab="actions"
                  showTabBar={false}
                />
              </TabsContent>
            ) : null}

            {canReadDocuments ? (
              <TabsContent
                value="kyc-review"
                keepMounted={keepMounted("kyc-review")}
                className="mt-0"
              >
                <AdminKycReviewPanel
                  hasDownload={hasPermission("documents.download")}
                  hasVerify={hasPermission("documents.verify")}
                />
              </TabsContent>
            ) : null}

            {canManageAdminAccounts ? (
              <TabsContent
                value="admin-accounts"
                keepMounted={keepMounted("admin-accounts")}
                className="mt-0"
              >
                <AdminAccountsPanel enabled={canManageAdminAccounts} />
              </TabsContent>
            ) : null}
          </div>
        </Tabs>
      )}
    </AdminSectionPageShell>
  );
}
