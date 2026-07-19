"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Shield } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminInfoDialogTrigger } from "@/components/ui/admin-dialog-presets";
import { RiskEnforcementLadderButton } from "@/components/settings/admin-risk-enforcement-ladder";
import { AdminSecurityConfigSettingsPanel } from "@/components/settings/admin-security-config-settings-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SecurityConfigItem } from "@/lib/admin-api";
import { ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";
import {
  resolveSecurityConfigTab,
  securityConfigTabHref,
  SECURITY_CONFIG_TABS,
  type SecurityConfigTabId,
} from "@/lib/admin-security-config-meta";

type AdminSecurityConfigPageProps = {
  tabSlug?: string;
};

const securityRoute = ADMIN_NAV_ROUTES.find((route) => route.id === "security-config");

export function AdminSecurityConfigPage({ tabSlug }: AdminSecurityConfigPageProps) {
  const router = useRouter();
  const [hasOtherItems, setHasOtherItems] = useState(false);

  const visibleTabs = useMemo(
    () => SECURITY_CONFIG_TABS.filter((tab) => tab.id !== "other" || hasOtherItems),
    [hasOtherItems],
  );

  const activeTab = resolveSecurityConfigTab(tabSlug, hasOtherItems);
  const [activeTabId, setActiveTabId] = useState<SecurityConfigTabId>(activeTab.id);
  const [riskItems, setRiskItems] = useState<SecurityConfigItem[]>([]);

  useEffect(() => {
    setActiveTabId(activeTab.id);
    const href = securityConfigTabHref(activeTab);
    const currentHref = tabSlug
      ? `/dashboard/security-config/${tabSlug}`
      : "/dashboard/security-config";
    if (href !== currentHref) {
      router.replace(href);
    }
  }, [activeTab, router, tabSlug]);

  const handleTabChange = (value: string) => {
    const nextTab = visibleTabs.find((tab) => tab.id === value);
    if (!nextTab) return;
    setActiveTabId(nextTab.id);
    router.push(securityConfigTabHref(nextTab));
  };

  const activeTabMeta = visibleTabs.find((tab) => tab.id === activeTabId) ?? activeTab;

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Platform" }, { label: "Security" }]}
      title="Security"
      description={securityRoute?.description}
      headerAside={
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {activeTabId === "risk" && riskItems.length > 0 ? (
            <RiskEnforcementLadderButton items={riskItems} />
          ) : null}
          <Link
            href="/dashboard/mf-integrations"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-3 py-2 text-caption font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Zynd Integrations
            <ArrowUpRight className="size-3.5" />
          </Link>
          <div className="admin-page-icon-tile shrink-0">
            <Shield className="size-5" />
          </div>
        </div>
      }
    >
      <Tabs value={activeTabId} onValueChange={handleTabChange} className="gap-4">
        <TabsList variant="line" className="w-fit justify-start border-b border-border">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2 px-4 py-2">
                <Icon className="size-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="rounded-[var(--radius-card)] border border-border bg-card px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <h2 className="text-compact font-semibold text-foreground">{activeTabMeta.label}</h2>
          {activeTabMeta.description ? (
            <AdminInfoDialogTrigger
              title={activeTabMeta.label}
              description={activeTabMeta.description}
            />
          ) : null}
        </div>
      </div>

      <AdminSecurityConfigSettingsPanel
        activeTab={activeTabId}
        onHasOtherItemsChange={setHasOtherItems}
        onRiskItemsChange={setRiskItems}
      />
    </AdminSectionPageShell>
  );
}
