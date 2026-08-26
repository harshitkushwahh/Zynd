"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { useOrdersSummaryQuery } from "@/hooks/use-orders-summary-query";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShoppingBag,
  Webhook,
  type LucideIcon,
} from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminTabComingSoon } from "@/components/dashboard/admin-tab-coming-soon";
import { AdminTabDisabled } from "@/components/dashboard/admin-tab-disabled";
import {
  MfTransactionOrdersPanel,
  ORDER_SORT_OPTIONS,
  ORDER_STATUS_OPTIONS,
  type OrderSortKey,
} from "@/components/mf/mf-transaction-orders-panel";
import {
  MfTransactionSipPlansPanel,
  SIP_STATUS_OPTIONS,
} from "@/components/mf/mf-transaction-sip-plans-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard, type AdminMetricCardTone } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { cn } from "@/lib/utils";
import {
  getTransactionSection,
  isSectionTabEnabled,
  resolveSectionTab,
  sectionTabHref,
} from "@/lib/admin-transaction-sections";

type OrdersSectionPageProps = {
  tabSlug?: string;
};

const ALL = "all";

type SummaryMetric = {
  key: string;
  label: string;
  value: string;
  infoDescription: string;
  icon: LucideIcon;
  tone: AdminMetricCardTone;
  accent?: boolean;
};

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
  isTabMounted,
}: {
  canRead: boolean;
  activeTabSlug: string;
  isTabMounted: (slug: string) => boolean;
}) {
  const { data, isPending } = useOrdersSummaryQuery(canRead);
  const showSkeleton = isPending && !data;

  const purchases = data?.purchases ?? { total: 0, pending: 0, succeeded: 0, failed: 0 };
  const sips = data?.sips ?? { total: 0, pending: 0, active: 0, failed: 0 };

  const comingSoonMetrics = useMemo(
    (): Record<string, SummaryMetric[]> => ({
      redemptions: zeroMetrics({
        total: "Redemptions",
        totalDescription: "Redemption orders and payout tracking.",
        totalIcon: ArrowDownToLine,
        pendingDescription: "Redemptions currently in progress.",
        succeededLabel: "Completed",
        succeededDescription: "Successfully completed redemptions.",
        failedDescription: "Failed or cancelled redemptions.",
      }),
      switches: zeroMetrics({
        total: "Switches",
        totalDescription: "Switch orders between schemes.",
        totalIcon: ArrowLeftRight,
        pendingDescription: "Switch orders currently in progress.",
        succeededLabel: "Completed",
        succeededDescription: "Successfully completed switches.",
        failedDescription: "Failed or cancelled switches.",
      }),
      webhooks: zeroMetrics({
        total: "Webhooks",
        totalDescription: "Webhook events, replay, and processing status.",
        totalIcon: Webhook,
        pendingDescription: "Webhook events currently processing.",
        succeededLabel: "Processed",
        succeededDescription: "Successfully processed webhook events.",
        failedDescription: "Failed or cancelled webhook events.",
      }),
    }),
    [],
  );

  const renderMetricGrid = (metrics: SummaryMetric[], loading: boolean) => (
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

  return (
    <div className="space-y-0">
      {isTabMounted("purchases") ? (
        <div className={cn(activeTabSlug !== "purchases" && "hidden")}>
          {renderMetricGrid(
            [
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
            ],
            showSkeleton,
          )}
        </div>
      ) : null}

      {isTabMounted("sip-installments") ? (
        <div className={cn(activeTabSlug !== "sip-installments" && "hidden")}>
          {renderMetricGrid(
            [
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
            ],
            showSkeleton,
          )}
        </div>
      ) : null}

      {(["redemptions", "switches", "webhooks"] as const).map((slug) =>
        isTabMounted(slug) ? (
          <div key={slug} className={cn(activeTabSlug !== slug && "hidden")}>
            {renderMetricGrid(comingSoonMetrics[slug], false)}
          </div>
        ) : null,
      )}
    </div>
  );
}

export function OrdersSectionPage({ tabSlug }: OrdersSectionPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const section = getTransactionSection("orders");
  const resolvedTab = section ? resolveSectionTab(section, tabSlug) : null;
  const { activeTab: activeTabSlug, selectTab, keepMounted } = useMountedTabs(
    resolvedTab?.slug ?? "purchases",
    resolvedTab?.slug,
  );
  const [listSearch, setListSearch] = useState("");
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState(ALL);
  const [purchaseSort, setPurchaseSort] = useState<OrderSortKey>("recent");
  const [sipStatusFilter, setSipStatusFilter] = useState(ALL);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (tabSlug === "ops-thresholds") {
      router.replace("/dashboard/security-config/ops-thresholds");
    }
  }, [router, tabSlug]);

  if (tabSlug === "ops-thresholds") return null;
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
      icon={ShoppingBag}
    >
      {!canRead ? (
        <AdminFeedbackMessage variant="warning" dismissible={false}>
          You do not have permission to view orders.
        </AdminFeedbackMessage>
      ) : (
        <div className="space-y-5">
          <OrdersSummaryCards
            canRead={canRead}
            activeTabSlug={activeTabSlug}
            isTabMounted={keepMounted}
          />

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
                    <Icon className="size-4 shrink-0" />
                    {tab.label}
                  </AdminTabTrigger>
                );
              })}
            </AdminTabList>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AdminSearchInput
                containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
                placeholder="Search by fund, customer, or ID"
                value={listSearch}
                onChange={(event) => setListSearch(event.target.value)}
              />

              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                {activeTabSlug === "purchases" ? (
                  <>
                    <AdminSelect
                      value={purchaseSort}
                      onValueChange={(value) => setPurchaseSort(value as OrderSortKey)}
                      options={ORDER_SORT_OPTIONS}
                      placeholder="Sort"
                      className="min-w-select-sm shrink-0"
                      triggerClassName="w-auto"
                    />
                    <AdminSelect
                      value={purchaseStatusFilter}
                      onValueChange={setPurchaseStatusFilter}
                      options={ORDER_STATUS_OPTIONS}
                      placeholder="Status"
                      className="min-w-select-sm shrink-0"
                      triggerClassName="w-auto"
                    />
                  </>
                ) : null}

                {activeTabSlug === "sip-installments" ? (
                  <AdminSelect
                    value={sipStatusFilter}
                    onValueChange={setSipStatusFilter}
                    options={SIP_STATUS_OPTIONS}
                    placeholder="Status"
                    className="min-w-select-sm shrink-0"
                    triggerClassName="w-auto"
                  />
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setRefreshKey((value) => value + 1)}
                >
                  <RefreshCw className="size-3.5" />
                  Refresh
                </Button>
              </div>
            </div>

            {section.tabs.map((tab) => (
              <TabsContent
                key={tab.slug}
                value={tab.slug}
                keepMounted={keepMounted(tab.slug)}
                className="mt-0"
              >
                {!isSectionTabEnabled(tab) ? (
                  <AdminTabDisabled label={tab.label} description={tab.description} />
                ) : tab.slug === "purchases" ? (
                  <MfTransactionOrdersPanel
                    canRead={canRead}
                    canManage={canManage}
                    showToolbar={false}
                    search={listSearch}
                    onSearchChange={setListSearch}
                    orderStatusFilter={purchaseStatusFilter}
                    onOrderStatusFilterChange={setPurchaseStatusFilter}
                    orderSort={purchaseSort}
                    onOrderSortChange={setPurchaseSort}
                    refreshKey={refreshKey}
                  />
                ) : tab.slug === "sip-installments" ? (
                  <MfTransactionSipPlansPanel
                    canRead={canRead}
                    canManage={canManage}
                    showToolbar={false}
                    search={listSearch}
                    onSearchChange={setListSearch}
                    statusFilter={sipStatusFilter}
                    onStatusFilterChange={setSipStatusFilter}
                    refreshKey={refreshKey}
                  />
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
