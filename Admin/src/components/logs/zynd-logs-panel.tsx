"use client";

import Image from "next/image";
import { ScrollText, ShieldCheck } from "lucide-react";

import { AdminSectionBreadcrumb } from "@/components/dashboard/admin-section-breadcrumb";
import { AdminPageHeader } from "@/components/dashboard/admin-page-header";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { AdminAccountRecordsPanel } from "@/components/logs/admin-account-records-panel";
import { PlatformAuditLogsPanel } from "@/components/logs/platform-audit-logs-panel";
import { ZyndProviderLogsTab } from "@/components/logs/zynd-provider-logs-tab";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { type ZyndLogSource } from "@/lib/zynd-logs-api";
import { ADMIN_NAV_ROUTES } from "@/lib/admin-navigation";

const zyndLogsRoute = ADMIN_NAV_ROUTES.find((route) => route.id === "zynd-logs");

const PLATFORM_TAB = "platform" as const;
const RECORD_TAB = "record" as const;

type ProviderLogTab = ZyndLogSource;
type LogTab = ProviderLogTab | typeof PLATFORM_TAB | typeof RECORD_TAB;

const LOG_TABS: Array<{
  key: LogTab;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    key: PLATFORM_TAB,
    label: "Platform Audit logs",
    icon: <ScrollText className="size-4 shrink-0" aria-hidden />,
  },
  {
    key: RECORD_TAB,
    label: "Record",
    icon: <ShieldCheck className="size-4 shrink-0" aria-hidden />,
  },
  {
    key: "cybrilla",
    label: "Cybrilla logs",
    icon: (
      <Image
        src="/cybrilla.jpeg"
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0 rounded-sm object-cover"
        aria-hidden
      />
    ),
  },
  {
    key: "fintech_primitive",
    label: "Fintech Primitive logs",
    icon: (
      <Image
        src="/fintech.jpeg"
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0 rounded-sm object-cover"
        aria-hidden
      />
    ),
  },
  {
    key: "kyckart",
    label: "KYC Kart logs",
    icon: (
      <Image
        src="/kyckart.jpeg"
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0 rounded-sm object-cover"
        aria-hidden
      />
    ),
  },
];

const PROVIDER_TABS = LOG_TABS.filter(
  (tab): tab is { key: ProviderLogTab; label: string; icon: React.ReactNode } =>
    tab.key !== PLATFORM_TAB && tab.key !== RECORD_TAB,
);

type ZyndLogsPanelProps = {
  initialRecordUserRef?: string;
  initialTab?: LogTab;
};

export function ZyndLogsPanel({ initialRecordUserRef, initialTab }: ZyndLogsPanelProps) {
  const { hasPermission } = useAdminAuth();
  const canRead = hasPermission("audit.read");
  const defaultTab = initialTab ?? (initialRecordUserRef ? RECORD_TAB : PLATFORM_TAB);
  const { activeTab, selectTab, keepMounted } = useMountedTabs<LogTab>(defaultTab);

  if (!canRead) {
    return (
      <div className="space-y-6">
        <AdminSectionBreadcrumb segments={[{ label: zyndLogsRoute?.label ?? "Zynd Logs" }]} />
        <AdminFeedbackMessage variant="warning" dismissible={false}>
          You do not have permission to view Zynd logs.
        </AdminFeedbackMessage>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminSectionBreadcrumb segments={[{ label: zyndLogsRoute?.label ?? "Zynd Logs" }]} />

      <AdminPageHeader title={zyndLogsRoute?.label ?? "Zynd Logs"} icon={ScrollText} />

      <Tabs
        value={activeTab}
        onValueChange={(value) => selectTab(value as LogTab)}
        className="gap-6"
      >
        <AdminTabList>
          {LOG_TABS.map((tab) => (
            <AdminTabTrigger key={tab.key} value={tab.key} className="gap-2">
              {tab.icon}
              {tab.label}
            </AdminTabTrigger>
          ))}
        </AdminTabList>

        <TabsContent value={PLATFORM_TAB} className="mt-0" keepMounted={keepMounted(PLATFORM_TAB)}>
          <PlatformAuditLogsPanel />
        </TabsContent>

        <TabsContent value={RECORD_TAB} className="mt-0" keepMounted={keepMounted(RECORD_TAB)}>
          <AdminAccountRecordsPanel initialUserRef={initialRecordUserRef} />
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
