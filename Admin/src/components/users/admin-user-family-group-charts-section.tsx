"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  LineChart,
  PieChart,
  Repeat,
  type LucideIcon,
} from "lucide-react";

import {
  AdminFamilyGroupDonutChart,
  adminFamilyGroupDonutLegendColor,
} from "@/components/users/admin-family-group-donut-chart";
import { AdminFamilyGroupOneTimePaymentChart } from "@/components/users/admin-family-group-one-time-payment-chart";
import { AdminFamilyGroupProgressAreaChart } from "@/components/users/admin-family-group-progress-area-chart";
import { AdminFamilyGroupSipAddonChart } from "@/components/users/admin-family-group-sip-addon-chart";
import { AdminFamilyGroupChartEmptyState } from "@/components/users/admin-family-group-chart-empty-state";
import {
  mapContributionChartToDonutSegments,
  mapPortfolioSlicesToDonutSegments,
  sumDonutSegmentValues,
} from "@/lib/admin-family-group-donut-chart-data";
import {
  mapRealProgressChartToSeries,
  type AdminFamilyGroupProgressPeriod,
} from "@/lib/admin-family-group-progress-chart-data";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import type {
  AdminFamilyGroupAnalyticsMember,
  AdminFamilyGroupContributionChartPoint,
  AdminFamilyGroupPortfolio,
  AdminFamilyGroupProgressChartPoint,
  AdminFamilyGroupOneTimePayment,
  AdminFamilyGroupSipAddon,
} from "@/lib/family-groups-admin-api";
import { formatCompactInr } from "@/lib/format-inr";
import { cn } from "@/lib/utils";

type ChartTab = "progress" | "portfolio" | "sips" | "one-time";

const CHART_TABS: Array<{ value: ChartTab; label: string; icon: LucideIcon }> = [
  { value: "progress", label: "Progress", icon: LineChart },
  { value: "portfolio", label: "Portfolio", icon: PieChart },
  { value: "sips", label: "SIP add-ons", icon: Repeat },
  { value: "one-time", label: "One-time", icon: Banknote },
];

type AdminUserFamilyGroupChartsSectionProps = {
  portfolio: AdminFamilyGroupPortfolio;
  contributionChart: AdminFamilyGroupContributionChartPoint[];
  progressChart: AdminFamilyGroupProgressChartPoint[];
  sipAddons: AdminFamilyGroupSipAddon[];
  oneTimePayments: AdminFamilyGroupOneTimePayment[];
  members: AdminFamilyGroupAnalyticsMember[];
  focusedMemberId: string | null;
  onFocusedMemberChange: (memberId: string | null) => void;
};

export function AdminUserFamilyGroupChartsSection({
  portfolio,
  contributionChart,
  progressChart,
  sipAddons,
  oneTimePayments,
  members,
  focusedMemberId,
  onFocusedMemberChange,
}: AdminUserFamilyGroupChartsSectionProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>("progress");
  const [progressPeriod, setProgressPeriod] = useState<AdminFamilyGroupProgressPeriod>("1Y");

  const contributionSegments = useMemo(
    () => mapContributionChartToDonutSegments(contributionChart),
    [contributionChart],
  );

  const allocationSegments = useMemo(
    () => mapPortfolioSlicesToDonutSegments(portfolio.slices),
    [portfolio.slices],
  );

  const contributionTotal = useMemo(
    () => sumDonutSegmentValues(contributionSegments),
    [contributionSegments],
  );

  const allocationTotal = useMemo(
    () =>
      portfolio.total_current_value_inr > 0
        ? portfolio.total_current_value_inr
        : sumDonutSegmentValues(allocationSegments),
    [allocationSegments, portfolio.total_current_value_inr],
  );

  const focusedMember = useMemo(
    () => members.find((member) => member.user_id === focusedMemberId) ?? null,
    [focusedMemberId, members],
  );

  const focusedContributionValue = useMemo(() => {
    if (!focusedMemberId) return contributionTotal;
    return (
      contributionSegments.find((segment) => segment.id === focusedMemberId)?.value ?? contributionTotal
    );
  }, [contributionSegments, contributionTotal, focusedMemberId]);

  const progressPoints = useMemo(
    () => mapRealProgressChartToSeries(progressChart, progressPeriod),
    [progressChart, progressPeriod],
  );

  const hasContributionData = contributionTotal > 0;
  const hasAllocationData = allocationTotal > 0;
  const portfolioIsEmpty = !hasContributionData && !hasAllocationData;

  const activeChartTab = CHART_TABS.find((tab) => tab.value === activeTab) ?? CHART_TABS[0];

  return (
    <section className="admin-user-family-group-detail__charts-section">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ChartTab)} className="gap-3">
        <div className="admin-user-family-group-detail__section-head admin-user-family-group-detail__charts-section-head">
          <h2 className="admin-user-family-group-detail__section-title">{activeChartTab.label}</h2>
          <AdminTabList variant="secondary" className="admin-user-family-group-detail__charts-tabs">
            {CHART_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <AdminTabTrigger key={tab.value} value={tab.value} className="gap-2">
                  <Icon className="size-4 shrink-0" />
                  {tab.label}
                </AdminTabTrigger>
              );
            })}
          </AdminTabList>
        </div>

        <TabsContent value="progress" className="mt-0">
          <Card className="admin-user-family-group-detail__chart-card ring-0 border-border bg-card p-4 shadow-sm">
            <AdminFamilyGroupProgressAreaChart
              points={progressPoints}
              period={progressPeriod}
              onPeriodChange={setProgressPeriod}
            />
          </Card>
        </TabsContent>

        <TabsContent value="portfolio" className="mt-0">
          {portfolioIsEmpty ? (
            <Card className="admin-user-family-group-detail__chart-card ring-0 border-border bg-card p-4 shadow-sm">
              <AdminFamilyGroupChartEmptyState
                label="No portfolio data yet"
                description="Member contributions and mutual fund allocation will appear here once this family group has investment activity."
              />
            </Card>
          ) : (
          <div className="admin-user-family-group-detail__portfolio-charts-grid">
            <Card className="admin-user-family-group-detail__chart-card ring-0 border-border bg-card p-4 shadow-sm">
              <h3 className="admin-user-family-group-detail__portfolio-chart-title">
                Member contribution
              </h3>
              <div
                className={cn(
                  "admin-user-family-group-detail__chart-body",
                  !hasContributionData && "admin-user-family-group-detail__chart-body--empty",
                )}
              >
                <AdminFamilyGroupDonutChart
                  segments={contributionSegments}
                  centerValue={formatCompactInr(focusedContributionValue)}
                  centerCaption={
                    focusedMember
                      ? (focusedMember.display_name.split(" ")[0] ?? focusedMember.display_name)
                      : "Group total"
                  }
                  emptyLabel="No member contributions yet"
                  emptyDescription="Contributions from family members will show up here once recorded."
                  focusedId={focusedMemberId}
                  onSegmentClick={(id) =>
                    onFocusedMemberChange(focusedMemberId === id ? null : id)
                  }
                />
                {contributionSegments.length > 0 ? (
                <ul className="admin-user-family-group-detail__legend">
                  {contributionSegments.map((segment, index) => (
                    <li key={segment.id}>
                      <button
                        type="button"
                        className={cn(
                          "admin-user-family-group-detail__legend-item",
                          focusedMemberId === segment.id &&
                            "admin-user-family-group-detail__legend-item--active",
                        )}
                        onClick={() =>
                          onFocusedMemberChange(focusedMemberId === segment.id ? null : segment.id)
                        }
                      >
                        <span
                          className="admin-user-family-group-detail__legend-dot"
                          style={{
                            background: segment.fill ?? adminFamilyGroupDonutLegendColor(index),
                          }}
                        />
                        <span className="truncate">{segment.label}</span>
                        <span className="tabular-nums">{formatCompactInr(segment.value)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                ) : null}
              </div>
            </Card>

            <Card className="admin-user-family-group-detail__chart-card ring-0 border-border bg-card p-4 shadow-sm">
              <h3 className="admin-user-family-group-detail__portfolio-chart-title">
                Asset allocation
              </h3>
              <div
                className={cn(
                  "admin-user-family-group-detail__chart-body",
                  !hasAllocationData && "admin-user-family-group-detail__chart-body--empty",
                )}
              >
                <AdminFamilyGroupDonutChart
                  segments={allocationSegments}
                  centerValue={formatCompactInr(allocationTotal)}
                  centerCaption="Current value"
                  emptyLabel="No allocation data yet"
                  emptyDescription="Asset allocation will appear here once members have linked mutual fund holdings."
                />
                {allocationSegments.length > 0 ? (
                <ul className="admin-user-family-group-detail__legend">
                  {allocationSegments.map((segment, index) => (
                    <li
                      key={segment.id}
                      className="admin-user-family-group-detail__legend-item admin-user-family-group-detail__legend-item--static"
                    >
                      <span
                        className="admin-user-family-group-detail__legend-dot"
                        style={{
                          background: segment.fill ?? adminFamilyGroupDonutLegendColor(index + 2),
                        }}
                      />
                      <span className="truncate">{segment.label}</span>
                      <span className="tabular-nums">{formatCompactInr(segment.value)}</span>
                    </li>
                  ))}
                </ul>
                ) : null}
              </div>
            </Card>
          </div>
          )}
        </TabsContent>

        <TabsContent value="sips" className="mt-0">
          <Card className="admin-user-family-group-detail__chart-card ring-0 border-border bg-card p-4 shadow-sm">
            <AdminFamilyGroupSipAddonChart addons={sipAddons} />
          </Card>
        </TabsContent>

        <TabsContent value="one-time" className="mt-0">
          <Card className="admin-user-family-group-detail__chart-card ring-0 border-border bg-card p-4 shadow-sm">
            <AdminFamilyGroupOneTimePaymentChart payments={oneTimePayments} />
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
