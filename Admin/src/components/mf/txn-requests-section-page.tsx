"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  fetchMfTransactionOrders,
  fetchMfTransactionSipPlans,
} from "@/lib/mf-transactions-admin-api";
import {
  getTransactionSection,
  isSectionTabEnabled,
  resolveSectionTab,
  sectionTabHref,
} from "@/lib/admin-transaction-sections";

type TxnRequestsSectionPageProps = {
  tabSlug?: string;
};

const PENDING_ORDER_STATUSES = new Set([
  "pending",
  "submitted",
  "payment_pending",
  "processing",
]);
const FAILED_ORDER_STATUSES = new Set(["failed", "cancelled"]);
const PENDING_SIP_STATUSES = new Set(["PENDING", "REVIEW", "CONSENT_PENDING"]);
const FAILED_SIP_STATUSES = new Set(["FAILED", "CANCELLED"]);

function TxnRequestsSummaryCards({ canRead }: { canRead: boolean }) {
  const [loading, setLoading] = useState(true);
  const [lumpsumCount, setLumpsumCount] = useState(0);
  const [sipCount, setSipCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const loadSummary = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const [ordersResult, plansResult] = await Promise.all([
        fetchMfTransactionOrders({
          order_type: "LUMPSUM",
          checkout_type: "SINGLE",
          limit: 50,
        }),
        fetchMfTransactionSipPlans({ limit: 50 }),
      ]);

      const orders = ordersResult.orders;
      const plans = plansResult.plans;

      setLumpsumCount(orders.length);
      setSipCount(plans.length);
      setPendingCount(
        orders.filter((item) => PENDING_ORDER_STATUSES.has(item.status.toLowerCase())).length +
          plans.filter((item) => PENDING_SIP_STATUSES.has(item.status.toUpperCase())).length,
      );
      setFailedCount(
        orders.filter((item) => FAILED_ORDER_STATUSES.has(item.status.toLowerCase())).length +
          plans.filter((item) => FAILED_SIP_STATUSES.has(item.status.toUpperCase())).length,
      );
    } catch {
      setLumpsumCount(0);
      setSipCount(0);
      setPendingCount(0);
      setFailedCount(0);
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
        key: "lumpsum",
        label: "Lumpsum requests",
        value: lumpsumCount.toLocaleString(),
        infoDescription: "Single-checkout lumpsum transaction requests.",
        icon: IndianRupee,
        tone: "info" as const,
        accent: true,
      },
      {
        key: "sip",
        label: "SIP requests",
        value: sipCount.toLocaleString(),
        infoDescription: "SIP creation and registration requests.",
        icon: Repeat,
        tone: "default" as const,
      },
      {
        key: "pending",
        label: "In progress",
        value: pendingCount.toLocaleString(),
        infoDescription: "Pending or processing lumpsum and SIP requests.",
        icon: LoaderCircle,
        tone: pendingCount > 0 ? ("warning" as const) : ("muted" as const),
      },
      {
        key: "failed",
        label: "Failed / cancelled",
        value: failedCount.toLocaleString(),
        infoDescription: "Failed or cancelled lumpsum and SIP requests.",
        icon: AlertTriangle,
        tone: failedCount > 0 ? ("warning" as const) : ("success" as const),
      },
    ],
    [failedCount, lumpsumCount, pendingCount, sipCount],
  );

  return (
    <AdminMetricCardsGrid columns="four" className="!mt-0">
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

export function TxnRequestsSectionPage({ tabSlug }: TxnRequestsSectionPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const section = getTransactionSection("txn-requests");

  if (!section) return null;

  const canRead = section.permissions.some((permission) => hasPermission(permission));
  const canManage = hasPermission("mf.transactions.manage");
  const activeTab = resolveSectionTab(section, tabSlug);

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
            orderType="LUMPSUM"
            checkoutType="SINGLE"
            emptyMessage="No lumpsum transaction requests found."
          />
        );
      case "sip":
        return <MfTransactionSipPlansPanel canRead={canRead} canManage={canManage} />;
      default:
        return <AdminTabComingSoon label={activeTab.label} description={activeTab.description} />;
    }
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

            <TabsContent value={activeTab.slug}>{renderTabContent()}</TabsContent>
          </Tabs>
        </div>
      )}
    </AdminSectionPageShell>
  );
}
