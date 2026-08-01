"use client";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminTabDisabled } from "@/components/dashboard/admin-tab-disabled";
import { AdminTabComingSoon } from "@/components/dashboard/admin-tab-coming-soon";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  getTransactionSection,
  isSectionTabEnabled,
  resolveSectionTab,
} from "@/lib/admin-transaction-sections";

type AdminTabbedSectionPageProps = {
  sectionId: string;
  tabSlug?: string;
};

export function AdminTabbedSectionPage({ sectionId, tabSlug }: AdminTabbedSectionPageProps) {
  const { hasPermission } = useAdminAuth();
  const section = getTransactionSection(sectionId);

  if (!section) return null;

  const canRead = section.permissions.some((permission) => hasPermission(permission));
  const activeTab = resolveSectionTab(section, tabSlug);
  const TabIcon = activeTab?.icon ?? section.icon;

  if (!activeTab) return null;

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[
        { label: section.label, href: section.href },
        { label: activeTab.label },
      ]}
      title={activeTab.label}
      icon={TabIcon}
    >
      {!canRead ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view {activeTab.label.toLowerCase()}.
        </AdminFeedbackMessage>
      ) : !isSectionTabEnabled(activeTab) ? (
        <AdminTabDisabled label={activeTab.label} description={activeTab.description} />
      ) : (
        <AdminTabComingSoon label={activeTab.label} description={activeTab.description} />
      )}
    </AdminSectionPageShell>
  );
}
