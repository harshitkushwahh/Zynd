"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { useBulkOrderSummaryQuery } from "@/hooks/use-bulk-order-summary-query";
import {
  AlertTriangle,
  IndianRupee,
  Layers,
  LoaderCircle,
  RefreshCw,
  Repeat,
} from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import {
  CHECKOUT_STATUS_OPTIONS,
  MfTransactionCheckoutsPanel,
} from "@/components/mf/mf-transaction-checkouts-panel";
import {
  MfTransactionSipBatchesPanel,
  SIP_BATCH_STATUS_OPTIONS,
} from "@/components/mf/mf-transaction-sip-batches-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";

type BulkOrderSectionPageProps = {
  tabSlug?: string;
};

const ALL = "all";

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

function BulkOrderSummaryCards({ canRead }: { canRead: boolean }) {
  const { data, isPending } = useBulkOrderSummaryQuery(canRead);
  const showSkeleton = isPending && !data;

  const summary = data ?? {
    lumpsumCount: 0,
    sipCount: 0,
    pendingCount: 0,
    failedCount: 0,
  };

  return (
    <AdminMetricCardsGrid columns="four" className="!mt-0">
      <AdminMetricCard
        key="lumpsum"
        label="Lumpsum orders"
        value={summary.lumpsumCount.toLocaleString()}
        infoDescription="Cart-based bulk lumpsum checkouts."
        icon={IndianRupee}
        tone="info"
        accent
        loading={showSkeleton}
      />
      <AdminMetricCard
        key="sip"
        label="SIP batches"
        value={summary.sipCount.toLocaleString()}
        infoDescription="Bulk SIP batches with shared mandate auth."
        icon={Repeat}
        loading={showSkeleton}
      />
      <AdminMetricCard
        key="pending"
        label="In progress"
        value={summary.pendingCount.toLocaleString()}
        infoDescription="Pending or processing lumpsum and SIP bulk orders."
        icon={LoaderCircle}
        tone={summary.pendingCount > 0 ? "warning" : "muted"}
        loading={showSkeleton}
      />
      <AdminMetricCard
        key="failed"
        label="Failed / cancelled"
        value={summary.failedCount.toLocaleString()}
        infoDescription="Failed or cancelled lumpsum and SIP bulk orders."
        icon={AlertTriangle}
        tone={summary.failedCount > 0 ? "warning" : "success"}
        loading={showSkeleton}
      />
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
  const { activeTab: activeTabSlug, selectTab, keepMounted } = useMountedTabs(
    activeTab.slug,
    activeTab.slug,
  );
  const [listSearch, setListSearch] = useState("");
  const [lumpsumStatusFilter, setLumpsumStatusFilter] = useState(ALL);
  const [sipStatusFilter, setSipStatusFilter] = useState(ALL);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabChange = (value: string) => {
    selectTab(value as (typeof BULK_ORDER_TABS)[number]["slug"]);
    if (value) router.push(`/dashboard/bulk-order/${value}`);
  };

  return (
    <Tabs value={activeTabSlug} onValueChange={handleTabChange} className="space-y-5">
      <AdminSectionPageShell
        breadcrumbSegments={[{ label: "Platform" }, { label: "Bulk Order" }]}
        title="Bulk Order"
        icon={Layers}
        headerAside={
          <AdminTabList className="max-w-full shrink-0">
            {BULK_ORDER_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <AdminTabTrigger key={tab.slug} value={tab.slug} className="gap-2">
                  <Icon className="size-4 shrink-0" />
                  {tab.label}
                </AdminTabTrigger>
              );
            })}
          </AdminTabList>
        }
      >
        {!canRead ? (
          <AdminFeedbackMessage variant="warning" dismissible={false}>
            You do not have permission to view bulk orders.
          </AdminFeedbackMessage>
        ) : (
          <div className="space-y-5">
            <BulkOrderSummaryCards canRead={canRead} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AdminSearchInput
                containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
                placeholder="Search by customer, fund, or ID"
                value={listSearch}
                onChange={(event) => setListSearch(event.target.value)}
              />

              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                {activeTabSlug === "lumpsum" ? (
                  <AdminSelect
                    value={lumpsumStatusFilter}
                    onValueChange={setLumpsumStatusFilter}
                    options={CHECKOUT_STATUS_OPTIONS}
                    placeholder="Status"
                    className="min-w-select-sm shrink-0"
                    triggerClassName="w-auto"
                  />
                ) : null}

                {activeTabSlug === "sip" ? (
                  <AdminSelect
                    value={sipStatusFilter}
                    onValueChange={setSipStatusFilter}
                    options={SIP_BATCH_STATUS_OPTIONS}
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

            <TabsContent value="lumpsum" keepMounted={keepMounted("lumpsum")} className="mt-0">
              <MfTransactionCheckoutsPanel
                canRead={canRead}
                showToolbar={false}
                search={listSearch}
                onSearchChange={setListSearch}
                statusFilter={lumpsumStatusFilter}
                onStatusFilterChange={setLumpsumStatusFilter}
                refreshKey={refreshKey}
              />
            </TabsContent>
            <TabsContent value="sip" keepMounted={keepMounted("sip")} className="mt-0">
              <MfTransactionSipBatchesPanel
                canRead={canRead}
                canManage={canManage}
                showToolbar={false}
                search={listSearch}
                onSearchChange={setListSearch}
                statusFilter={sipStatusFilter}
                onStatusFilterChange={setSipStatusFilter}
                refreshKey={refreshKey}
              />
            </TabsContent>
          </div>
        )}
      </AdminSectionPageShell>
    </Tabs>
  );
}
