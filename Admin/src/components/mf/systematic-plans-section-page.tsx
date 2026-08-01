"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, ShieldCheck, Timer, Users } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminTabComingSoon } from "@/components/dashboard/admin-tab-coming-soon";
import { MfMandatesPanel } from "@/components/mf/mf-mandates-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { fetchMfTransactionMandates } from "@/lib/mf-transactions-admin-api";
import {
  getTransactionSection,
  resolveSectionTab,
  sectionTabHref,
} from "@/lib/admin-transaction-sections";

type SystematicPlansSectionPageProps = {
  tabSlug?: string;
};

function SystematicPlansSummaryCards({ canRead }: { canRead: boolean }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total_mandates: 0,
    active_mandates: 0,
    auth_pending_mandates: 0,
  });

  const loadSummary = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const result = await fetchMfTransactionMandates({ limit: 50 });
      setSummary(result.summary);
    } catch {
      setSummary({
        total_mandates: 0,
        active_mandates: 0,
        auth_pending_mandates: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const metrics = useMemo(
    () => [
      {
        key: "total",
        label: "Total mandates",
        value: summary.total_mandates.toLocaleString(),
        infoDescription: "All user mandates linked to systematic plans.",
        icon: Users,
        tone: "info" as const,
        accent: true,
      },
      {
        key: "active",
        label: "Active mandates",
        value: summary.active_mandates.toLocaleString(),
        infoDescription: "Approved mandates ready for SIP collections.",
        icon: ShieldCheck,
        tone: summary.active_mandates > 0 ? ("success" as const) : ("muted" as const),
      },
      {
        key: "auth-pending",
        label: "Auth pending",
        value: summary.auth_pending_mandates.toLocaleString(),
        infoDescription: "Mandates waiting for customer authorization.",
        icon: Timer,
        tone: summary.auth_pending_mandates > 0 ? ("warning" as const) : ("muted" as const),
      },
    ],
    [summary],
  );

  return (
    <AdminMetricCardsGrid columns="three" className="!mt-0">
      {metrics.map((metric) => (
        <AdminMetricCard
          key={metric.key}
          label={metric.label}
          value={metric.value}
          infoDescription={metric.infoDescription}
          icon={metric.icon}
          tone={metric.tone}
          accent={metric.accent}
          loading={loading}
        />
      ))}
    </AdminMetricCardsGrid>
  );
}

export function SystematicPlansSectionPage({ tabSlug }: SystematicPlansSectionPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const section = getTransactionSection("systematic-plans");

  if (!section) return null;

  const canRead = section.permissions.some((permission) => hasPermission(permission));
  const canManage = hasPermission("mf.transactions.manage");
  const activeTab = resolveSectionTab(section, tabSlug);

  if (!activeTab) return null;

  const renderTabContent = () => {
    switch (activeTab.slug) {
      case "sips":
        return (
          <MfMandatesPanel
            canRead={canRead}
            canManage={canManage}
            showSummaryCards={false}
          />
        );
      case "stps":
      case "swps":
        return (
          <AdminTabComingSoon label={activeTab.label} description={activeTab.description} />
        );
      default:
        return null;
    }
  };

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Platform" }, { label: section.label }]}
      title={section.label}
      icon={Repeat}
    >
      {!canRead ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view systematic plans.
        </AdminFeedbackMessage>
      ) : (
        <div className="space-y-5">
          <SystematicPlansSummaryCards canRead={canRead} />

          <Tabs
            value={activeTab.slug}
            onValueChange={(value) => {
              const nextTab = section.tabs.find((tab) => tab.slug === value);
              if (nextTab) router.push(sectionTabHref(section, nextTab));
            }}
            className="space-y-4"
          >
            <AdminTabList>
              {section.tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <AdminTabTrigger key={tab.slug} value={tab.slug} className="gap-2">
                    <Icon className="size-4" />
                    {tab.label}
                  </AdminTabTrigger>
                );
              })}
            </AdminTabList>

            <TabsContent value={activeTab.slug}>{renderTabContent()}</TabsContent>
          </Tabs>
        </div>
      )}
    </AdminSectionPageShell>
  );
}
