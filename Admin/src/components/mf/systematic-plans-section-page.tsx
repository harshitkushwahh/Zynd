"use client";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminTabDisabled } from "@/components/dashboard/admin-tab-disabled";
import { AdminTabComingSoon } from "@/components/dashboard/admin-tab-coming-soon";
import { MfMandatesPanel } from "@/components/mf/mf-mandates-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  getTransactionSection,
  isSectionTabEnabled,
  resolveSectionTab,
} from "@/lib/admin-transaction-sections";

type SystematicPlansSectionPageProps = {
  tabSlug?: string;
};

export function SystematicPlansSectionPage({ tabSlug }: SystematicPlansSectionPageProps) {
  const { hasPermission } = useAdminAuth();
  const section = getTransactionSection("systematic-plans");

  if (!section) return null;

  const canRead = section.permissions.some((permission) => hasPermission(permission));
  const canManage = hasPermission("mf.transactions.manage");
  const activeTab = resolveSectionTab(section, tabSlug);
  const TabIcon = activeTab?.icon ?? section.icon;

  if (!activeTab) return null;

  const renderTabContent = () => {
    if (!isSectionTabEnabled(activeTab)) {
      return <AdminTabDisabled label={activeTab.label} description={activeTab.description} />;
    }
    if (activeTab.slug === "sips") {
      return <MfMandatesPanel canRead={canRead} canManage={canManage} />;
    }
    return <AdminTabComingSoon label={activeTab.label} description={activeTab.description} />;
  };

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[
        { label: section.label, href: section.href },
        { label: activeTab.label },
      ]}
      title={activeTab.label}
      description={activeTab.description}
      icon={TabIcon}
    >
      {!canRead ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view {activeTab.label.toLowerCase()}.
        </AdminFeedbackMessage>
      ) : (
        renderTabContent()
      )}
    </AdminSectionPageShell>
  );
}
