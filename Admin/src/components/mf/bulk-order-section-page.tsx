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
import { MfTransactionCheckoutsPanel } from "@/components/mf/mf-transaction-checkouts-panel";
import { MfTransactionSipBatchesPanel } from "@/components/mf/mf-transaction-sip-batches-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  fetchMfTransactionCheckouts,
  fetchMfTransactionSipBatches,
} from "@/lib/mf-transactions-admin-api";

type BulkOrderSectionPageProps = {
  tabSlug?: string;
};

const BULK_ORDER_TABS = [
  {
    slug: "lumpsum",
    label: "Lumpsum",
    icon: IndianRupee,
  },
  {
    slug: "sip",
    label: "SIP",
    icon: Repeat,
  },
] as const;

const PENDING_CHECKOUT_STATUSES = new Set([
  "PENDING",
  "PAYMENT_PENDING",
  "SUBMITTED",
  "PROCESSING",
]);
const FAILED_CHECKOUT_STATUSES = new Set(["FAILED", "CANCELLED"]);
const PENDING_MANDATE_STATUSES = new Set(["PENDING", "AUTH_PENDING"]);
const FAILED_MANDATE_STATUSES = new Set(["FAILED", "CANCELLED"]);

function BulkOrderSummaryCards({ canRead }: { canRead: boolean }) {
  const [loading, setLoading] = useState(true);
  const [lumpsumCount, setLumpsumCount] = useState(0);
  const [sipCount, setSipCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const loadSummary = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const [checkoutsResult, batchesResult] = await Promise.all([
        fetchMfTransactionCheckouts({ checkout_type: "CART", limit: 50 }),
        fetchMfTransactionSipBatches({ limit: 50 }),
      ]);

      const checkouts = checkoutsResult.checkouts;
      const batches = batchesResult.batches;

      setLumpsumCount(checkouts.length);
      setSipCount(batches.length);
      setPendingCount(
        checkouts.filter((item) => PENDING_CHECKOUT_STATUSES.has(item.status.toUpperCase()))
          .length +
          batches.filter((item) =>
            PENDING_MANDATE_STATUSES.has(item.mandate_status.toUpperCase()),
          ).length,
      );
      setFailedCount(
        checkouts.filter((item) => FAILED_CHECKOUT_STATUSES.has(item.status.toUpperCase()))
          .length +
          batches.filter((item) =>
            FAILED_MANDATE_STATUSES.has(item.mandate_status.toUpperCase()),
          ).length,
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
        label: "Lumpsum orders",
        value: lumpsumCount.toLocaleString(),
        infoDescription: "Cart-based bulk lumpsum checkouts.",
        icon: IndianRupee,
        tone: "info" as const,
        accent: true,
      },
      {
        key: "sip",
        label: "SIP batches",
        value: sipCount.toLocaleString(),
        infoDescription: "Bulk SIP batches with shared mandate auth.",
        icon: Repeat,
        tone: "default" as const,
      },
      {
        key: "pending",
        label: "In progress",
        value: pendingCount.toLocaleString(),
        infoDescription: "Pending or processing lumpsum and SIP bulk orders.",
        icon: LoaderCircle,
        tone: pendingCount > 0 ? ("warning" as const) : ("muted" as const),
      },
      {
        key: "failed",
        label: "Failed / cancelled",
        value: failedCount.toLocaleString(),
        infoDescription: "Failed or cancelled lumpsum and SIP bulk orders.",
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

export function BulkOrderSectionPage({ tabSlug }: BulkOrderSectionPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const canRead = hasPermission("mf.transactions.read");
  const canManage = hasPermission("mf.transactions.manage");

  const activeTab =
    BULK_ORDER_TABS.find((tab) => tab.slug === tabSlug) ?? BULK_ORDER_TABS[0];

  return (
    <AdminSectionPageShell
      breadcrumbSegments={[{ label: "Platform" }, { label: "Bulk Order" }]}
      title="Bulk Order"
      icon={Layers}
    >
      {!canRead ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view bulk orders.
        </AdminFeedbackMessage>
      ) : (
        <div className="space-y-5">
          <BulkOrderSummaryCards canRead={canRead} />

          <Tabs
            value={activeTab.slug}
            onValueChange={(value) => {
              if (value) router.push(`/dashboard/bulk-order/${value}`);
            }}
            className="space-y-4"
          >
            <AdminTabList>
              {BULK_ORDER_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <AdminTabTrigger key={tab.slug} value={tab.slug} className="gap-2">
                    <Icon className="size-4" />
                    {tab.label}
                  </AdminTabTrigger>
                );
              })}
            </AdminTabList>

            <TabsContent value="lumpsum">
              <MfTransactionCheckoutsPanel canRead={canRead} />
            </TabsContent>
            <TabsContent value="sip">
              <MfTransactionSipBatchesPanel canRead={canRead} canManage={canManage} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AdminSectionPageShell>
  );
}
