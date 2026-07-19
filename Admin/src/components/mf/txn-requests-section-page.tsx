"use client";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminTabComingSoon } from "@/components/dashboard/admin-tab-coming-soon";
import { AdminTabDisabled } from "@/components/dashboard/admin-tab-disabled";
import { MfTransactionOrdersPanel } from "@/components/mf/mf-transaction-orders-panel";
import { MfTransactionSipPlansPanel } from "@/components/mf/mf-transaction-sip-plans-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  getTransactionSection,
  isSectionTabEnabled,
  resolveSectionTab,
} from "@/lib/admin-transaction-sections";

type TxnRequestsSectionPageProps = {
  tabSlug?: string;
};

export function TxnRequestsSectionPage({ tabSlug }: TxnRequestsSectionPageProps) {
  const { hasPermission } = useAdminAuth();
  const section = getTransactionSection("txn-requests");

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

    switch (activeTab.slug) {
      case "lumpsum":
        return (
          <MfTransactionOrdersPanel
            canRead={canRead}
            canManage={canManage}
            title="Lumpsum transaction requests"
            orderType="LUMPSUM"
            checkoutType="SINGLE"
            emptyMessage="No lumpsum transaction requests found."
          />
        );
      case "sip":
        return (
          <MfTransactionSipPlansPanel
            canRead={canRead}
            canManage={canManage}
            title="SIP transaction requests"
          />
        );
      default:
        return <AdminTabComingSoon label={activeTab.label} description={activeTab.description} />;
    }
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
