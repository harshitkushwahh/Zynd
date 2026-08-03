"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  IndianRupee,
  Layers,
  LoaderCircle,
  Repeat,
} from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminTabComingSoon } from "@/components/dashboard/admin-tab-coming-soon";
import { AdminTabDisabled } from "@/components/dashboard/admin-tab-disabled";
import { MfTransactionOrdersPanel } from "@/components/mf/mf-transaction-orders-panel";
import { MfTransactionSipPlansPanel } from "@/components/mf/mf-transaction-sip-plans-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { useTxnRequestsSummaryQuery } from "@/hooks/use-txn-requests-summary-query";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  getTransactionSection,
  isSectionTabEnabled,
  resolveSectionTab,
  sectionTabHref,
} from "@/lib/admin-transaction-sections";

type TxnRequestsSectionPageProps = {
  tabSlug?: string;
};

function TxnRequestsSummaryCards({ canRead }: { canRead: boolean }) {
  const { data, isPending } = useTxnRequestsSummaryQuery(canRead);
  const showSkeleton = isPending && !data;

  const summary = data ?? {
    lumpsumCount: 0,
    sipCount: 0,
    pendingCount: 0,
    failedCount: 0,
  };

  return (
    <AdminMetricCardsGrid columns="four" className="!mt-0">
      <AdminMetricCard
        key="lumpsum"
        label="Lumpsum requests"
        value={summary.lumpsumCount.toLocaleString()}
        infoDescription="Single-checkout lumpsum transaction requests."
        icon={IndianRupee}
        tone="info"
        accent
        loading={showSkeleton}
      />
      <AdminMetricCard
        key="sip"
        label="SIP requests"
        value={summary.sipCount.toLocaleString()}
        infoDescription="SIP creation and registration requests."
        icon={Repeat}
        loading={showSkeleton}
      />
      <AdminMetricCard
        key="pending"
        label="In progress"
        value={summary.pendingCount.toLocaleString()}
        infoDescription="Pending or processing lumpsum and SIP requests."
        icon={LoaderCircle}
        tone={summary.pendingCount > 0 ? "warning" : "muted"}
        loading={showSkeleton}
      />
      <AdminMetricCard
        key="failed"
        label="Failed / cancelled"
        value={summary.failedCount.toLocaleString()}
        infoDescription="Failed or cancelled lumpsum and SIP requests."
        icon={AlertTriangle}
        tone={summary.failedCount > 0 ? "warning" : "success"}
        loading={showSkeleton}
      />
    </AdminMetricCardsGrid>
  );
}

export function TxnRequestsSectionPage({ tabSlug }: TxnRequestsSectionPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const section = getTransactionSection("txn-requests");
  const resolvedTab = section ? resolveSectionTab(section, tabSlug) : null;
  const { activeTab: activeTabSlug, selectTab, keepMounted } = useMountedTabs(
    resolvedTab?.slug ?? "lumpsum",
    resolvedTab?.slug,
  );

  if (!section || !resolvedTab) return null;

  const canRead = section.permissions.some((permission) => hasPermission(permission));
  const canManage = hasPermission("mf.transactions.manage");

  const handleTabChange = (value: string) => {
    selectTab(value);
    const nextTab = section.tabs.find((tab) => tab.slug === value);
    if (nextTab) router.push(sectionTabHref(section, nextTab));
  };

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Platform" }, { label: section.label }]}
      title={section.label}
      icon={Layers}
    >
      {!canRead ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view transaction requests.
        </AdminFeedbackMessage>
      ) : (
        <div className="space-y-5">
          <TxnRequestsSummaryCards canRead={canRead} />

          <Tabs value={activeTabSlug} onValueChange={handleTabChange} className="space-y-4">
            <AdminTabList>
              {section.tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <AdminTabTrigger
                    key={tab.slug}
                    value={tab.slug}
                    className="gap-2"
                    disabled={!isSectionTabEnabled(tab)}
                  >
                    <Icon className="size-4" />
                    {tab.label}
                  </AdminTabTrigger>
                );
              })}
            </AdminTabList>

            {section.tabs.map((tab) => (
              <TabsContent
                key={tab.slug}
                value={tab.slug}
                keepMounted={keepMounted(tab.slug)}
              >
                {!isSectionTabEnabled(tab) ? (
                  <AdminTabDisabled label={tab.label} description={tab.description} />
                ) : tab.slug === "lumpsum" ? (
                  <MfTransactionOrdersPanel
                    canRead={canRead}
                    canManage={canManage}
                    orderType="LUMPSUM"
                    checkoutType="SINGLE"
                    emptyMessage="No lumpsum transaction requests found."
                  />
                ) : tab.slug === "sip" ? (
                  <MfTransactionSipPlansPanel canRead={canRead} canManage={canManage} />
                ) : (
                  <AdminTabComingSoon label={tab.label} description={tab.description} />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </AdminSectionPageShell>
  );
}
