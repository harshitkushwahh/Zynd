"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  LoaderCircle,
  ShoppingBag,
  Webhook,
  type LucideIcon,
} from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminTabComingSoon } from "@/components/dashboard/admin-tab-coming-soon";
import { MfTransactionOrdersPanel } from "@/components/mf/mf-transaction-orders-panel";
import { MfTransactionSipPlansPanel } from "@/components/mf/mf-transaction-sip-plans-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard, type AdminMetricCardTone } from "@/components/ui/admin-metric-card";
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
  resolveSectionTab,
  sectionTabHref,
} from "@/lib/admin-transaction-sections";

type OrdersSectionPageProps = {
  tabSlug?: string;
};

type SummaryMetric = {
  key: string;
  label: string;
  value: string;
  infoDescription: string;
  icon: LucideIcon;
  tone: AdminMetricCardTone;
  accent?: boolean;
};

const PENDING_ORDER_STATUSES = new Set([
  "pending",
  "submitted",
  "payment_pending",
  "processing",
]);
const SUCCEEDED_ORDER_STATUSES = new Set(["succeeded"]);
const FAILED_ORDER_STATUSES = new Set(["failed", "cancelled"]);
const PENDING_SIP_STATUSES = new Set(["PENDING", "REVIEW", "CONSENT_PENDING"]);
const ACTIVE_SIP_STATUSES = new Set(["ACTIVE"]);
const FAILED_SIP_STATUSES = new Set(["FAILED", "CANCELLED"]);

function zeroMetrics(labels: {
  total: string;
  totalDescription: string;
  totalIcon: LucideIcon;
  pendingDescription: string;
  succeededLabel: string;
  succeededDescription: string;
  failedDescription: string;
}): SummaryMetric[] {
  return [
    {
      key: "total",
      label: labels.total,
      value: "0",
      infoDescription: labels.totalDescription,
      icon: labels.totalIcon,
      tone: "info",
      accent: true,
    },
    {
      key: "pending",
      label: "In progress",
      value: "0",
      infoDescription: labels.pendingDescription,
      icon: LoaderCircle,
      tone: "muted",
    },
    {
      key: "succeeded",
      label: labels.succeededLabel,
      value: "0",
      infoDescription: labels.succeededDescription,
      icon: CheckCircle2,
      tone: "muted",
    },
    {
      key: "failed",
      label: "Failed / cancelled",
      value: "0",
      infoDescription: labels.failedDescription,
      icon: AlertTriangle,
      tone: "success",
    },
  ];
}

function OrdersSummaryCards({
  canRead,
  activeTabSlug,
}: {
  canRead: boolean;
  activeTabSlug: string;
}) {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState({
    total: 0,
    pending: 0,
    succeeded: 0,
    failed: 0,
  });
  const [sips, setSips] = useState({
    total: 0,
    pending: 0,
    active: 0,
    failed: 0,
  });

  const loadSummary = useCallback(async () => {
    if (!canRead) return;
    if (
      activeTabSlug === "redemptions" ||
      activeTabSlug === "switches" ||
      activeTabSlug === "webhooks"
    ) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (activeTabSlug === "sip-installments") {
        const plansResult = await fetchMfTransactionSipPlans({ limit: 50 });
        const plans = plansResult.plans;
        setSips({
          total: plans.length,
          pending: plans.filter((item) =>
            PENDING_SIP_STATUSES.has(item.status.toUpperCase()),
          ).length,
          active: plans.filter((item) =>
            ACTIVE_SIP_STATUSES.has(item.status.toUpperCase()),
          ).length,
          failed: plans.filter((item) =>
            FAILED_SIP_STATUSES.has(item.status.toUpperCase()),
          ).length,
        });
      } else {
        const ordersResult = await fetchMfTransactionOrders({ limit: 50 });
        const orders = ordersResult.orders;
        setPurchases({
          total: orders.length,
          pending: orders.filter((item) =>
            PENDING_ORDER_STATUSES.has(item.status.toLowerCase()),
          ).length,
          succeeded: orders.filter((item) =>
            SUCCEEDED_ORDER_STATUSES.has(item.status.toLowerCase()),
          ).length,
          failed: orders.filter((item) =>
            FAILED_ORDER_STATUSES.has(item.status.toLowerCase()),
          ).length,
        });
      }
    } catch {
      setPurchases({ total: 0, pending: 0, succeeded: 0, failed: 0 });
      setSips({ total: 0, pending: 0, active: 0, failed: 0 });
    } finally {
      setLoading(false);
    }
  }, [activeTabSlug, canRead]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const metrics = useMemo((): SummaryMetric[] => {
    if (activeTabSlug === "sip-installments") {
      return [
        {
          key: "total",
          label: "SIP installments",
          value: sips.total.toLocaleString(),
          infoDescription: "Recurring SIP plans and installment status.",
          icon: CalendarClock,
          tone: "info",
          accent: true,
        },
        {
          key: "pending",
          label: "In progress",
          value: sips.pending.toLocaleString(),
          infoDescription: "SIP plans pending review or consent.",
          icon: LoaderCircle,
          tone: sips.pending > 0 ? "warning" : "muted",
        },
        {
          key: "active",
          label: "Active",
          value: sips.active.toLocaleString(),
          infoDescription: "SIP plans currently active.",
          icon: CheckCircle2,
          tone: sips.active > 0 ? "success" : "muted",
        },
        {
          key: "failed",
          label: "Failed / cancelled",
          value: sips.failed.toLocaleString(),
          infoDescription: "Failed or cancelled SIP plans.",
          icon: AlertTriangle,
          tone: sips.failed > 0 ? "warning" : "success",
        },
      ];
    }

    if (activeTabSlug === "redemptions") {
      return zeroMetrics({
        total: "Redemptions",
        totalDescription: "Redemption orders and payout tracking.",
        totalIcon: ArrowDownToLine,
        pendingDescription: "Redemptions currently in progress.",
        succeededLabel: "Completed",
        succeededDescription: "Successfully completed redemptions.",
        failedDescription: "Failed or cancelled redemptions.",
      });
    }

    if (activeTabSlug === "switches") {
      return zeroMetrics({
        total: "Switches",
        totalDescription: "Switch orders between schemes.",
        totalIcon: ArrowLeftRight,
        pendingDescription: "Switch orders currently in progress.",
        succeededLabel: "Completed",
        succeededDescription: "Successfully completed switches.",
        failedDescription: "Failed or cancelled switches.",
      });
    }

    if (activeTabSlug === "webhooks") {
      return zeroMetrics({
        total: "Webhooks",
        totalDescription: "Webhook events, replay, and processing status.",
        totalIcon: Webhook,
        pendingDescription: "Webhook events currently processing.",
        succeededLabel: "Processed",
        succeededDescription: "Successfully processed webhook events.",
        failedDescription: "Failed or cancelled webhook events.",
      });
    }

    return [
      {
        key: "total",
        label: "Purchases",
        value: purchases.total.toLocaleString(),
        infoDescription: "Lumpsum and one-time purchase orders.",
        icon: ShoppingBag,
        tone: "info",
        accent: true,
      },
      {
        key: "pending",
        label: "In progress",
        value: purchases.pending.toLocaleString(),
        infoDescription: "Purchase orders pending or processing.",
        icon: LoaderCircle,
        tone: purchases.pending > 0 ? "warning" : "muted",
      },
      {
        key: "succeeded",
        label: "Succeeded",
        value: purchases.succeeded.toLocaleString(),
        infoDescription: "Successfully completed purchase orders.",
        icon: CheckCircle2,
        tone: purchases.succeeded > 0 ? "success" : "muted",
      },
      {
        key: "failed",
        label: "Failed / cancelled",
        value: purchases.failed.toLocaleString(),
        infoDescription: "Failed or cancelled purchase orders.",
        icon: AlertTriangle,
        tone: purchases.failed > 0 ? "warning" : "success",
      },
    ];
  }, [activeTabSlug, purchases, sips]);

  const isComingSoonTab =
    activeTabSlug === "redemptions" ||
    activeTabSlug === "switches" ||
    activeTabSlug === "webhooks";

  return (
    <AdminMetricCardsGrid columns="four" className="!mt-0">
      {metrics.map((metric) => (
        <AdminMetricCard
          key={`${activeTabSlug}-${metric.key}`}
          label={metric.label}
          value={metric.value}
          infoDescription={metric.infoDescription}
          icon={metric.icon}
          tone={metric.tone}
          accent={metric.accent}
          loading={loading && !isComingSoonTab}
        />
      ))}
    </AdminMetricCardsGrid>
  );
}

export function OrdersSectionPage({ tabSlug }: OrdersSectionPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const section = getTransactionSection("orders");

  useEffect(() => {
    if (tabSlug === "ops-thresholds") {
      router.replace("/dashboard/security-config/ops-thresholds");
    }
  }, [router, tabSlug]);

  if (tabSlug === "ops-thresholds") return null;
  if (!section) return null;

  const canRead = section.permissions.some((permission) => hasPermission(permission));
  const canManage = hasPermission("mf.transactions.manage");
  const activeTab = resolveSectionTab(section, tabSlug);

  if (!activeTab) return null;

  const renderTabContent = () => {
    switch (activeTab.slug) {
      case "purchases":
        return <MfTransactionOrdersPanel canRead={canRead} canManage={canManage} />;
      case "sip-installments":
        return <MfTransactionSipPlansPanel canRead={canRead} canManage={canManage} />;
      case "redemptions":
      case "switches":
      case "webhooks":
        return (
          <AdminTabComingSoon label={activeTab.label} description={activeTab.description} />
        );
      default:
        return (
          <AdminTabComingSoon label={activeTab.label} description={activeTab.description} />
        );
    }
  };

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Platform" }, { label: section.label }]}
      title={section.label}
      icon={ShoppingBag}
    >
      {!canRead ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view orders.
        </AdminFeedbackMessage>
      ) : (
        <div className="space-y-5">
          <OrdersSummaryCards canRead={canRead} activeTabSlug={activeTab.slug} />

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
