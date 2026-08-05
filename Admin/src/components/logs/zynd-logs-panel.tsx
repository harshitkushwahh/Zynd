"use client";

import { ScrollText } from "lucide-react";

import { AdminSectionBreadcrumb } from "@/components/dashboard/admin-section-breadcrumb";
import { AdminPageHeader } from "@/components/dashboard/admin-page-header";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { PlatformAuditLogsPanel } from "@/components/logs/platform-audit-logs-panel";
import { ZyndProviderLogsTab } from "@/components/logs/zynd-provider-logs-tab";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { type ZyndLogSource } from "@/lib/zynd-logs-api";
import { ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";

const zyndLogsRoute = ADMIN_NAV_ROUTES.find((route) => route.id === "zynd-logs");

const PLATFORM_TAB = "platform" as const;

type ProviderLogTab = ZyndLogSource;
type LogTab = ProviderLogTab | typeof PLATFORM_TAB;

const LOG_TABS: Array<{ key: LogTab; label: string }> = [
  { key: PLATFORM_TAB, label: "Platform Audit logs" },
  { key: "cybrilla", label: "Cybrilla logs" },
  { key: "fintech_primitive", label: "Fintech Primitive logs" },
  { key: "kyckart", label: "KYC Kart logs" },
];

const PROVIDER_TABS = LOG_TABS.filter(
  (tab): tab is { key: ProviderLogTab; label: string } => tab.key !== PLATFORM_TAB,
);

export function ZyndLogsPanel() {
  const { hasPermission } = useAdminAuth();
  const canRead = hasPermission("audit.read");
  const { activeTab, selectTab, keepMounted } = useMountedTabs<LogTab>(PLATFORM_TAB);

  if (!canRead) {
    return (
      <div className="space-y-6">
        <AdminSectionBreadcrumb segments={[{ label: zyndLogsRoute?.label ?? "Zynd Logs" }]} />
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view Zynd logs.
        </AdminFeedbackMessage>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminSectionBreadcrumb segments={[{ label: zyndLogsRoute?.label ?? "Zynd Logs" }]} />

      <AdminPageHeader
        title={zyndLogsRoute?.label ?? "Zynd Logs"}
        aside={
          <div className="admin-page-icon-tile shrink-0">
            <ScrollText className="size-5" />
          </div>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => selectTab(value as LogTab)}
        className="gap-6"
      >
        <AdminTabList>
          {LOG_TABS.map((tab) => (
            <AdminTabTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </AdminTabTrigger>
          ))}
        </AdminTabList>

        <TabsContent value={PLATFORM_TAB} className="mt-0" keepMounted={keepMounted(PLATFORM_TAB)}>
          <PlatformAuditLogsPanel />
        </TabsContent>

        {PROVIDER_TABS.map((tab) => (
          <TabsContent
            key={tab.key}
            value={tab.key}
            className="mt-0"
            keepMounted={keepMounted(tab.key)}
          >
            <ZyndProviderLogsTab
              source={tab.key}
              canRead={canRead}
              active={activeTab === tab.key}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
