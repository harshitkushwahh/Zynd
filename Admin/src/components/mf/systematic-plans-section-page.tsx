"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Repeat, ShieldCheck, Timer, Users } from "lucide-react";

import { AdminSectionPageShell } from "@/components/dashboard/admin-section-page-shell";
import { AdminTabComingSoon } from "@/components/dashboard/admin-tab-coming-soon";
import { MANDATE_STATUS_OPTIONS, MfMandatesPanel } from "@/components/mf/mf-mandates-panel";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import { AdminSelect } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import { useSystematicPlansSummaryQuery } from "@/hooks/use-systematic-plans-summary-query";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  getTransactionSection,
  resolveSectionTab,
  sectionTabHref,
} from "@/lib/admin-transaction-sections";

type SystematicPlansSectionPageProps = {
  tabSlug?: string;
};

const ALL = "all";

function SystematicPlansSummaryCards({ canRead }: { canRead: boolean }) {
  const { data, isPending } = useSystematicPlansSummaryQuery(canRead);
  const showSkeleton = isPending && !data;

  const summary = data ?? {
    total_mandates: 0,
    active_mandates: 0,
    auth_pending_mandates: 0,
  };

  return (
    <AdminMetricCardsGrid columns="three" className="!mt-0">
      <AdminMetricCard
        key="total"
        label="Total mandates"
        value={summary.total_mandates.toLocaleString()}
        infoDescription="All user mandates linked to systematic plans."
        icon={Users}
        tone="info"
        accent
        loading={showSkeleton}
      />
      <AdminMetricCard
        key="active"
        label="Active mandates"
        value={summary.active_mandates.toLocaleString()}
        infoDescription="Approved mandates ready for SIP collections."
        icon={ShieldCheck}
        tone={summary.active_mandates > 0 ? "success" : "muted"}
        loading={showSkeleton}
      />
      <AdminMetricCard
        key="auth-pending"
        label="Auth pending"
        value={summary.auth_pending_mandates.toLocaleString()}
        infoDescription="Mandates waiting for customer authorization."
        icon={Timer}
        tone={summary.auth_pending_mandates > 0 ? "warning" : "muted"}
        loading={showSkeleton}
      />
    </AdminMetricCardsGrid>
  );
}

export function SystematicPlansSectionPage({ tabSlug }: SystematicPlansSectionPageProps) {
  const router = useRouter();
  const { hasPermission } = useAdminAuth();
  const section = getTransactionSection("systematic-plans");
  const resolvedTab = section ? resolveSectionTab(section, tabSlug) : null;
  const { activeTab: activeTabSlug, selectTab, keepMounted } = useMountedTabs(
    resolvedTab?.slug ?? "sips",
    resolvedTab?.slug,
  );
  const [listSearch, setListSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [refreshKey, setRefreshKey] = useState(0);

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
      icon={Repeat}
    >
      {!canRead ? (
        <AdminFeedbackMessage variant="warning">
          You do not have permission to view systematic plans.
        </AdminFeedbackMessage>
      ) : (
        <div className="space-y-5">
          <SystematicPlansSummaryCards canRead={canRead} />

          <Tabs value={activeTabSlug} onValueChange={handleTabChange} className="space-y-4">
            <AdminTabList>
              {section.tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <AdminTabTrigger key={tab.slug} value={tab.slug} className="gap-2">
                    <Icon className="size-4 shrink-0" />
                    {tab.label}
                  </AdminTabTrigger>
                );
              })}
            </AdminTabList>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AdminSearchInput
                containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
                placeholder="Search by customer or mandate ID"
                value={listSearch}
                onChange={(event) => setListSearch(event.target.value)}
              />

              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
                {activeTabSlug === "sips" ? (
                  <AdminSelect
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    options={MANDATE_STATUS_OPTIONS}
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
                {tab.slug === "sips" ? (
                  <MfMandatesPanel
                    canRead={canRead}
                    canManage={canManage}
                    showSummaryCards={false}
                    showToolbar={false}
                    search={listSearch}
                    onSearchChange={setListSearch}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
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
