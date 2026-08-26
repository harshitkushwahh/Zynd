"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Shield } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { MfTransactionOpsThresholdsPanel } from "@/components/mf/mf-transaction-ops-thresholds-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSecurityConfigSettingsPanel } from "@/components/settings/admin-security-config-settings-panel";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  resolveSecurityConfigTab,
  securityConfigTabHref,
  SECURITY_CONFIG_TABS,
  type SecurityConfigTabId,
} from "@/lib/admin-security-config-meta";

type AdminSecurityConfigPageProps = {
  tabSlug?: string;
};

export function AdminSecurityConfigPage({ tabSlug }: AdminSecurityConfigPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const canReadMfTransactions = hasPermission("mf.transactions.read");
  const canManageMfTransactions = hasPermission("mf.transactions.manage");
  const [hasOtherItems, setHasOtherItems] = useState(false);

  const visibleTabs = useMemo(
    () =>
      SECURITY_CONFIG_TABS.filter((tab) => {
        if (tab.id === "other") return hasOtherItems;
        return true;
      }),
    [hasOtherItems],
  );

  const activeTab = resolveSecurityConfigTab(tabSlug, hasOtherItems);
  const { activeTab: activeTabId, selectTab, keepMounted } = useMountedTabs<SecurityConfigTabId>(
    activeTab.id,
    activeTab.id,
  );

  useEffect(() => {
    selectTab(activeTab.id);
    const href = securityConfigTabHref(activeTab);
    const currentHref = tabSlug
      ? `/dashboard/security-config/${tabSlug}`
      : "/dashboard/security-config";
    if (href !== currentHref) {
      router.replace(href);
    }
  }, [activeTab, router, selectTab, tabSlug]);

  const handleTabChange = (value: string) => {
    const nextTab = visibleTabs.find((tab) => tab.id === value);
    if (!nextTab) return;
    selectTab(nextTab.id);
    router.push(securityConfigTabHref(nextTab));
  };

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Platform" }, { label: "Security" }]}
      title="Security"
      icon={Shield}
      headerAside={
        <Link
          href="/dashboard/mf-integrations"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-3 py-2 text-caption font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Zynd Integrations
          <ArrowUpRight className="size-3.5" />
        </Link>
      }
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

        <TabsContent value="ops-thresholds" keepMounted={keepMounted("ops-thresholds")}>
          {canReadMfTransactions ? (
            <MfTransactionOpsThresholdsPanel
              canRead={canReadMfTransactions}
              canManage={canManageMfTransactions}
            />
          ) : (
            <AdminFeedbackMessage variant="warning" dismissible={false}>
              You do not have permission to view mutual fund ops thresholds.
            </AdminFeedbackMessage>
          )}
        </TabsContent>
      </Tabs>

      {(keepMounted("lockout") || keepMounted("risk") || keepMounted("other")) ? (
        <div className={activeTabId === "ops-thresholds" ? "hidden" : undefined} aria-hidden={activeTabId === "ops-thresholds"}>
          <AdminSecurityConfigSettingsPanel
            activeTab={
              activeTabId === "ops-thresholds"
                ? "lockout"
                : activeTabId
            }
            onHasOtherItemsChange={setHasOtherItems}
          />
        </div>
      ) : null}
    </AdminSectionPageShell>
  );
}
