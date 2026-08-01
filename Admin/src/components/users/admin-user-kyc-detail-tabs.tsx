"use client";

import { useMemo, useState } from "react";
import { Fingerprint, ScrollText, ShieldAlert, Wallet } from "lucide-react";

import { AdminUserKycAuditLogPanel } from "@/components/users/admin-user-kyc-audit-log-panel";
import { AdminUserKycBankingPanels } from "@/components/users/admin-user-kyc-banking-panels";
import { AdminUserKycCompliancePanel } from "@/components/users/admin-user-kyc-compliance-panel";
import { AdminUserKycIdentityPanels } from "@/components/users/admin-user-kyc-identity-panels";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { AdminUserKycDetail } from "@/lib/admin-api";

const KYC_DETAIL_TABS = [
  { value: "compliance", label: "Compliance", icon: ShieldAlert },
  { value: "audit", label: "Audit log", icon: ScrollText },
  { value: "identity", label: "Identity", icon: Fingerprint },
  { value: "banking", label: "Banking & nominees", icon: Wallet },
] as const;

type KycDetailTab = (typeof KYC_DETAIL_TABS)[number]["value"];

type AdminUserKycDetailTabsProps = {
  kyc: AdminUserKycDetail;
  hasDownload: boolean;
  actionLoading: string | null;
  signatureDocumentId: string | null;
  onPreview: (documentId: string) => void;
};

export function AdminUserKycDetailTabs({
  kyc,
  hasDownload,
  actionLoading,
  signatureDocumentId,
  onPreview,
}: AdminUserKycDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<KycDetailTab>("identity");

  const openComplianceCount = useMemo(
    () => (kyc.compliance_issues ?? []).filter((issue) => issue.status === "open").length,
    [kyc.compliance_issues],
  );

  const activeTabMeta = KYC_DETAIL_TABS.find((tab) => tab.value === activeTab) ?? KYC_DETAIL_TABS[2];

  return (
    <section className="admin-user-kyc-detail__tabs-section space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as KycDetailTab)}
        className="gap-3"
      >
        <div className="admin-user-family-group-detail__section-head">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="admin-user-family-group-detail__section-title">{activeTabMeta.label}</h2>
            {activeTab === "compliance" && openComplianceCount > 0 ? (
              <StatusBadge variant="warning">
                {openComplianceCount} open
              </StatusBadge>
            ) : null}
          </div>
          <AdminTabList variant="secondary" className="admin-user-kyc-detail__tabs">
            {KYC_DETAIL_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <AdminTabTrigger key={tab.value} value={tab.value} className="gap-2">
                  <Icon className="size-4 shrink-0" />
                  {tab.label}
                  {tab.value === "compliance" && openComplianceCount > 0 ? (
                    <StatusBadge variant="warning" showIcon={false} className="ml-0.5">
                      {openComplianceCount}
                    </StatusBadge>
                  ) : null}
                </AdminTabTrigger>
              );
            })}
          </AdminTabList>
        </div>

        <TabsContent value="compliance" className="mt-0">
          <AdminUserKycCompliancePanel issues={kyc.compliance_issues ?? []} />
        </TabsContent>

        <TabsContent value="audit" className="mt-0">
          <AdminUserKycAuditLogPanel entries={kyc.audit_log ?? []} />
        </TabsContent>

        <TabsContent value="identity" className="mt-0">
          <AdminUserKycIdentityPanels
            kyc={kyc}
            hasDownload={hasDownload}
            actionLoading={actionLoading}
            onPreview={onPreview}
          />
        </TabsContent>

        <TabsContent value="banking" className="mt-0">
          <AdminUserKycBankingPanels
            kyc={kyc}
            hasDownload={hasDownload}
            signatureDocumentId={signatureDocumentId}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
